import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Popconfirm, message, Space, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { Title } = Typography;

interface Category {
  id: number;
  name: string;
  sort_order: number;
}

const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form] = Form.useForm();

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/categories');
      setCategories(data);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/categories', values);
        message.success('添加成功');
      }
      setModalOpen(false);
      form.resetFields();
      setEditingCategory(null);
      fetchCategories();
    } catch (e: any) {
      if (!e.errorFields) {
        message.error(e?.response?.data?.error || '操作失败');
      }
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/categories/${id}`);
      message.success('删除成功');
      fetchCategories();
    } catch (e: any) {
      message.error(e?.response?.data?.error || '删除失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '分类名称', dataIndex: 'name' },
    { title: '排序', dataIndex: 'sort_order', width: 100 },
    {
      title: '操作', width: 160,
      render: (_: any, record: Category) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingCategory(record);
              form.setFieldsValue({ name: record.name, sortOrder: record.sort_order });
              setModalOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm title="确定删除？如该分类下有工作记录则无法删除。" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>分类管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingCategory(null); form.resetFields(); setModalOpen(true); }}>
          添加分类
        </Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={categories} loading={loading} pagination={false} />
      <Modal
        title={editingCategory ? '编辑分类' : '添加分类'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="分类名称" name="name" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="排序" name="sortOrder">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CategoriesPage;
