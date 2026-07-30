import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { useUnit } from '../../hooks/useUnit';

const { Title, Text } = Typography;

const SettingsPage: React.FC = () => {
  const { unitName, appTitle, refresh } = useUnit();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState(true);
  const [currentApiKey, setCurrentApiKey] = useState('');

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      setCurrentApiKey(data.deepseekApiKey || '');
      form.setFieldsValue({
        unitName: data.unitName || '',
        deepseekApiKey: data.deepseekApiKey || '',
      });
    }).catch(() => {});
  }, [form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await api.put('/settings', {
        unitName: values.unitName,
        deepseekApiKey: values.deepseekApiKey || '',
      });
      message.success('设置已保存');
      setCurrentApiKey(values.deepseekApiKey || '');
      setApiKeyMasked(true);
      refresh();
    } catch (e: any) {
      if (!e.errorFields) {
        message.error(e?.response?.data?.error || '保存失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const maskKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 12) return key.substring(0, 4) + '****';
    return key.substring(0, 6) + '****' + key.substring(key.length - 4);
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>系统设置</Title>

      <Card title="基本设置" style={{ maxWidth: 600, marginBottom: 24 }}>
        <Form form={form} layout="vertical">
          <Form.Item
            label="单位名称"
            name="unitName"
            help="设置后系统标题将显示为'单位名称+工作台'，留空则显示为'工作台'"
          >
            <Input placeholder="例如：京四社" maxLength={20} style={{ maxWidth: 300 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" loading={loading} onClick={handleSave}>保存设置</Button>
          </Form.Item>
        </Form>
        <Text type="secondary">当前系统标题：{appTitle}</Text>
      </Card>

      <Card title="API 配置" style={{ maxWidth: 600 }}>
        <Form form={form} layout="vertical">
          <Form.Item
            label="Deepseek API Key"
            name="deepseekApiKey"
            help="用于 AI 智能分类、总结生成和信息稿扩写。也可通过服务器 .env 文件配置。"
          >
            <Input.Password
              placeholder="sk-..."
              iconRender={(visible) =>
                visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
              }
              maxLength={100}
              style={{ maxWidth: 500 }}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" loading={loading} onClick={handleSave}>保存 API 配置</Button>
          </Form.Item>
        </Form>
        <Text type="secondary">
          当前 Key：{currentApiKey ? maskKey(currentApiKey) : '未配置'}
          {apiKeyMasked && currentApiKey ? (
            <a style={{ marginLeft: 8 }} onClick={() => setApiKeyMasked(false)}>显示</a>
          ) : (
            !apiKeyMasked && currentApiKey ? (
              <a style={{ marginLeft: 8 }} onClick={() => setApiKeyMasked(true)}>隐藏</a>
            ) : null
          )}
        </Text>
      </Card>
    </div>
  );
};

export default SettingsPage;
