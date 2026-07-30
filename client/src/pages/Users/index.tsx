import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Popconfirm, message, Space, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { Title } = Typography;

interface User {
  id: number;
  username: string;
  display_name: string;
  role: string;
  created_at: string;
  last_login_at: string;
}

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/users', values);
      message.success('用户创建成功');
      setModalOpen(false);
      form.resetFields();
      fetchUsers();
    } catch (e: any) {
      if (!e.errorFields) {
        message.error(e?.response?.data?.error || '创建失败');
      }
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/users/${id}`);
      message.success('删除成功');
      fetchUsers();
    } catch (e: any) {
      message.error(e?.response?.data?.error || '删除失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username' },
    { title: '显示姓名', dataIndex: 'display_name' },
    {
      title: '角色', dataIndex: 'role', width: 100,
      render: (role: string) => role === 'admin' ? '管理员' : '工作人员',
    },
    { title: '创建时间', dataIndex: 'created_at', width: 170 },
    { title: '最后登录', dataIndex: 'last_login_at', width: 170, render: (v: string) => v || '-' },
    {
      title: '操作', width: 80,
      render: (_: any, record: User) => (
        <Popconfirm title="确定删除该用户？" onConfirm={() => handleDelete(record.id)}>
          <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>用户管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
          添加用户
        </Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={users} loading={loading} pagination={false} />
      <Modal
        title="添加用户"
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="显示姓名" name="displayName" rules={[{ required: true, message: '请输入显示姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, min: 6, max: 20, message: '密码长度6-20位' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label="角色" name="role" initialValue="staff">
            <Select>
              <Select.Option value="staff">工作人员</Select.Option>
              <Select.Option value="admin">管理员</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsersPage;
