import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import api from '../../services/api';
import { useUnit } from '../../hooks/useUnit';

const { Title, Text } = Typography;

const SettingsPage: React.FC = () => {
  const { unitName, appTitle, refresh } = useUnit();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    form.setFieldsValue({ unitName });
  }, [unitName, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await api.put('/settings', { unitName: values.unitName });
      message.success('设置已保存');
      refresh();
    } catch (e: any) {
      if (!e.errorFields) {
        message.error(e?.response?.data?.error || '保存失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>系统设置</Title>
      <Card title="基本设置" style={{ maxWidth: 600 }}>
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
    </div>
  );
};

export default SettingsPage;
