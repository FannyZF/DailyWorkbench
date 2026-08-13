import { useState, useEffect } from 'react';
import { Card, Form, DatePicker, Button, Upload, Input, Select, message, Space, Typography, Steps, Result, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const { TextArea } = Input;
const { Title, Text } = Typography;

interface EntryForm {
  key: number;
  description: string;
  category: string;
  imageFiles: UploadFile[];
}

const UploadPage: React.FC = () => {
  const [form] = Form.useForm();
  const [entries, setEntries] = useState<EntryForm[]>([{ key: 0, description: '', category: '', imageFiles: [] }]);
  const [nextKey, setNextKey] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [result, setResult] = useState<{ entries: { id: number; description: string; category: string }[] } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/categories').then(({ data }) => {
      setCategories((data || []).map((c: any) => c.name));
    }).catch(() => {});
  }, []);

  const addEntry = () => {
    if (entries.length >= 50) { message.warning('单次最多提交50条工作条目'); return; }
    setEntries([...entries, { key: nextKey, description: '', category: '', imageFiles: [] }]);
    setNextKey(nextKey + 1);
  };

  const removeEntry = (key: number) => {
    if (entries.length <= 1) return;
    setEntries(entries.filter(e => e.key !== key));
  };

  const updateDescription = (key: number, value: string) => {
    setEntries(entries.map(e => e.key === key ? { ...e, description: value } : e));
  };

  const updateCategory = (key: number, value: string) => {
    setEntries(entries.map(e => e.key === key ? { ...e, category: value } : e));
  };

  const updateImages = (key: number, fileList: UploadFile[]) => {
    setEntries(entries.map(e => e.key === key ? { ...e, imageFiles: fileList } : e));
  };

  const handleSubmit = async (values: { workDate: dayjs.Dayjs }) => {
    const validEntries = entries.filter(e => e.description.trim().length >= 10);
    if (validEntries.length === 0) { message.error('请至少填写一条工作描述（不少于10字）'); return; }

    const workDate = values.workDate.format('YYYY-MM-DD');
    setLoading(true);

    try {
      const { data } = await api.post('/upload/batch', {
        workDate,
        entries: validEntries.map(e => ({
          description: e.description.trim(),
          category: e.category || undefined,
        })),
      });

      message.success(`提交成功：${data.entries.length} 条已归档并智能分类`);

      for (let i = 0; i < data.entries.length; i++) {
        const originalEntry = validEntries[i];
        const createdEntry = data.entries[i];
        const files = originalEntry.imageFiles.filter(f => f.originFileObj);
        if (files.length > 0 && createdEntry) {
          const formData = new FormData();
          files.forEach(file => {
            if (file.originFileObj) formData.append('images', file.originFileObj);
          });
          try {
            await api.post(`/upload/${createdEntry.id}/images`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } catch { /* image upload failed silently */ }
        }
      }

      setResult({ entries: data.entries });
    } catch (e: any) {
      message.error(e?.response?.data?.error || '提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEntries([{ key: 0, description: '', category: '', imageFiles: [] }]);
    setNextKey(1);
    setResult(null);
    form.setFieldsValue({ workDate: dayjs() });
  };

  if (result) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <Result
          icon={<CheckCircleOutlined />}
          title="提交成功"
          subTitle={`以下 ${result.entries.length} 条工作内容已归档并智能分类`}
          extra={[
            <Button type="primary" key="go" onClick={() => navigate('/archive/browse')}>查看全部</Button>,
            <Button key="again" onClick={resetForm}>继续上传</Button>,
          ]}
        />
        <div style={{ marginTop: 16 }}>
          {result.entries.map((entry, idx) => (
            <Card key={entry.id} size="small" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <Text>{idx + 1}. {entry.description}</Text>
                </div>
                <Tag color="blue">{entry.category}</Tag>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Steps
        size="small"
        current={0}
        style={{ marginBottom: 24 }}
        items={[
          { title: '填写工作内容', description: '逐条填写描述、选择分类、上传图片' },
          { title: '提交归档', description: '未选分类的条目由 AI 自动归类' },
        ]}
      />

      <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ workDate: dayjs() }}>
        <Form.Item label="工作日期" name="workDate" rules={[{ required: true, message: '请选择工作日期' }]}>
          <DatePicker style={{ width: 200 }} />
        </Form.Item>

        {entries.map((entry, index) => (
          <Card
            key={entry.key}
            size="small"
            title={`工作条目 ${index + 1}`}
            style={{ marginBottom: 16 }}
            extra={
              entries.length > 1 ? (
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeEntry(entry.key)} />
              ) : null
            }
          >
            <Form.Item label="工作内容描述" required>
              <TextArea
                rows={3}
                maxLength={2000}
                showCount
                placeholder="请描述本次工作的具体内容（至少10个字）..."
                value={entry.description}
                onChange={e => updateDescription(entry.key, e.target.value)}
              />
            </Form.Item>
            <Form.Item label="分类（可选，不选则由 AI 自动归类）">
              <Select
                placeholder="不选择，交由 AI 自动归类"
                allowClear
                style={{ width: 240 }}
                value={entry.category || undefined}
                onChange={(v) => updateCategory(entry.key, v || '')}
              >
                {categories.map(c => (
                  <Select.Option key={c} value={c}>{c}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="相关图片（可选，最多50张）">
              <Upload
                multiple
                listType="picture-card"
                fileList={entry.imageFiles}
                onChange={({ fileList }) => updateImages(entry.key, fileList)}
                beforeUpload={() => false}
                accept="image/jpeg,image/png,image/webp"
              >
                {entry.imageFiles.length < 50 && (
                  <div>
                    <PlusOutlined />
                    <div style={{ marginTop: 8 }}>上传</div>
                  </div>
                )}
              </Upload>
            </Form.Item>
          </Card>
        ))}

        <Space style={{ marginBottom: 24 }} wrap>
          <Button type="dashed" icon={<PlusOutlined />} onClick={addEntry} disabled={entries.length >= 50}>
            添加工作条目
          </Button>
          <Typography.Text type="secondary">已添加 {entries.length}/50</Typography.Text>
        </Space>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} size="large">
            提交归档（AI自动分类）
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default UploadPage;
