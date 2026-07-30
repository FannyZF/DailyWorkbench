import { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, DatePicker, Select, Input, Tag, Pagination, Drawer, Modal,
  Button, Form, Space, Image, Typography, Empty, Spin, message, Popconfirm,
  Segmented, Table, Checkbox
} from 'antd';
import { SearchOutlined, EditOutlined, DeleteOutlined, FileTextOutlined, CameraOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const { Text, Paragraph } = Typography;

const categoryColorPool = ['blue', 'green', 'red', 'purple', 'cyan', 'orange', 'magenta', 'gold', 'geekblue', 'lime'];
function getCategoryColor(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) { hash = category.charCodeAt(i) + ((hash << 5) - hash); }
  return categoryColorPool[Math.abs(hash) % categoryColorPool.length];
}

function normalizePath(p: string): string {
  if (!p) return '';
  if (p.startsWith('http') || p.startsWith('/')) return p.replace(/\\/g, '/');
  return '/' + p.replace(/\\/g, '/');
}

interface WorkEntry {
  id: number;
  batch_id: string;
  description: string;
  category: string;
  work_date: string;
  created_by: number;
  creator_name: string;
  images: { id: number; originalName: string; storedPath: string; thumbPath: string }[];
}

interface Category {
  id: number;
  name: string;
}

type ViewMode = 'card' | 'table';

const BrowsePage: React.FC = () => {
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const [date, setDate] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [keyword, setKeyword] = useState('');

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<WorkEntry | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm] = Form.useForm();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoPrefix, setPhotoPrefix] = useState('');
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('card');

  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data);
    } catch { /* ignore */ }
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, pageSize: 12 };
      if (date) params.date = date;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (category) params.category = category;
      if (keyword) params.keyword = keyword;

      const { data } = await api.get('/work', { params });
      setEntries(data.entries);
      setTotal(data.total);
    } catch {
      message.error('查询失败');
    } finally {
      setLoading(false);
    }
  }, [page, date, startDate, endDate, category, keyword]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/work/${id}`);
      message.success('已删除');
      setSelectedIds(prev => prev.filter(sid => sid !== id));
      fetchEntries();
    } catch { message.error('删除失败'); }
  };

  const handleViewDetail = (entry: WorkEntry) => {
    setSelectedEntry(entry);
    setEditing(false);
    setDrawerVisible(true);
  };

  const handleEditSave = async () => {
    if (!selectedEntry) return;
    try {
      const values = editForm.getFieldsValue();
      await api.put(`/work/${selectedEntry.id}`, {
        description: values.description,
        category: values.category,
        workDate: values.workDate ? dayjs(values.workDate).format('YYYY-MM-DD') : undefined,
      });
      message.success('更新成功');
      setEditing(false);
      setDrawerVisible(false);
      fetchEntries();
    } catch { message.error('更新失败'); }
  };

  const handleRecategorize = async (id: number) => {
    try {
      const { data } = await api.post(`/ai/categorize/${id}`);
      message.success(`已重新分类为: ${data.category}`);
      if (selectedEntry) setSelectedEntry({ ...selectedEntry, category: data.category });
      fetchEntries();
    } catch { message.error('分类失败'); }
  };

  const handleCreateDraft = () => {
    if (selectedIds.length === 0) { message.warning('请勾选需要生成信息稿的工作内容'); return; }
    navigate('/archive/draft', { state: { selectedIds } });
  };

  const handleExportPhotos = async () => {
    if (!photoPrefix.trim()) { message.warning('请输入文件名前缀'); return; }
    setExporting(true);
    try {
      const response = await api.post('/work/export-photos', {
        ids: selectedIds,
        prefix: photoPrefix.trim(),
      }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${photoPrefix.trim()}_photos.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('照片导出成功');
      setPhotoModalOpen(false);
      setPhotoPrefix('');
    } catch (e: any) {
      if (e?.response?.status === 404) {
        message.warning('所选内容没有关联照片');
      } else {
        message.error(e?.response?.data?.error || '导出失败');
      }
    } finally {
      setExporting(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const tableColumns: ColumnsType<WorkEntry> = [
    {
      title: '',
      dataIndex: 'id',
      width: 50,
      render: (_, record) => (
        <Checkbox checked={selectedIds.includes(record.id)} onChange={() => toggleSelect(record.id)} />
      ),
    },
    {
      title: '日期',
      dataIndex: 'work_date',
      width: 110,
      sorter: (a, b) => a.work_date.localeCompare(b.work_date),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
      render: (cat: string) => <Tag color={getCategoryColor(cat)}>{cat}</Tag>,
    },
    {
      title: '工作内容',
      dataIndex: 'description',
      ellipsis: true,
      render: (desc: string) => (
        <Text style={{ maxWidth: '100%' }} ellipsis>{desc}</Text>
      ),
    },
    {
      title: '图片',
      dataIndex: 'images',
      width: 80,
      align: 'center',
      render: (imgs: WorkEntry['images']) => (
        <Text type={imgs?.length > 0 ? undefined : 'secondary'}>{imgs?.length || 0}张</Text>
      ),
    },
    {
      title: '操作',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleViewDetail(record)}>查看</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const renderCards = () => (
    <Row gutter={[16, 16]}>
      {entries.map(entry => (
        <Col key={entry.id} xs={24} sm={12} md={8} lg={8} xl={6}>
          <Card
            hoverable
            onClick={() => handleViewDetail(entry)}
            cover={
              entry.images && entry.images.length > 0 ? (
                <div style={{ height: 160, overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={normalizePath(entry.images[0].thumbPath)}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {entry.images.length > 1 && (
                    <div style={{
                      position: 'absolute', bottom: 8, right: 8,
                      background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '2px 8px',
                      borderRadius: 4, fontSize: 12,
                    }}>
                      +{entry.images.length - 1}
                    </div>
                  )}
                </div>
              ) : undefined
            }
            bodyStyle={{ padding: 12 }}
            actions={[
              <Popconfirm key="del" title="确定删除？" onConfirm={e => { e?.stopPropagation(); handleDelete(entry.id); }}>
                <DeleteOutlined key="delete" onClick={e => e.stopPropagation()} />
              </Popconfirm>,
            ]}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Tag color={getCategoryColor(entry.category)} style={{ margin: 0 }}>{entry.category}</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>{entry.work_date}</Text>
            </div>
            <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0, fontSize: 13, minHeight: 40 }}>
              {entry.description}
            </Paragraph>
            <div onClick={e => e.stopPropagation()} style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Checkbox
                checked={selectedIds.includes(entry.id)}
                onChange={() => toggleSelect(entry.id)}
              />
              <Text style={{ fontSize: 12, color: '#888' }}>选择此项</Text>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );

  const renderTable = () => (
    <Table
      rowKey="id"
      columns={tableColumns}
      dataSource={entries}
      loading={loading}
      pagination={false}
      size="middle"
      onRow={(record) => ({
        onClick: () => handleViewDetail(record),
        style: { cursor: 'pointer' },
      })}
    />
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>内容浏览</Typography.Title>
          <Segmented
            value={viewMode}
            onChange={v => setViewMode(v as ViewMode)}
            options={[
              { value: 'card', icon: <AppstoreOutlined /> },
              { value: 'table', icon: <UnorderedListOutlined /> },
            ]}
          />
        </div>
        <Space>
          {isAdmin && (
            <>
              <Button icon={<CameraOutlined />} disabled={selectedIds.length === 0} onClick={() => setPhotoModalOpen(true)}>
                导出照片 ({selectedIds.length})
              </Button>
              <Button icon={<FileTextOutlined />} disabled={selectedIds.length === 0} onClick={handleCreateDraft}>
                生成信息稿 ({selectedIds.length})
              </Button>
            </>
          )}
        </Space>
      </div>

      <Space wrap style={{ marginBottom: 24 }}>
        <DatePicker placeholder="选择日期" onChange={d => setDate(d ? d.format('YYYY-MM-DD') : '')} />
        <DatePicker placeholder="开始日期" onChange={d => setStartDate(d ? d.format('YYYY-MM-DD') : '')} />
        <DatePicker placeholder="结束日期" onChange={d => setEndDate(d ? d.format('YYYY-MM-DD') : '')} />
        <Select
          placeholder="分类筛选"
          allowClear
          style={{ minWidth: 150 }}
          value={category || undefined}
          onChange={(v) => setCategory(v || '')}
        >
          {categories.map(c => (
            <Select.Option key={c.id} value={c.name}>{c.name}</Select.Option>
          ))}
        </Select>
        <Input
          placeholder="搜索关键词"
          prefix={<SearchOutlined />}
          style={{ width: 250 }}
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onPressEnter={() => { setPage(1); fetchEntries(); }}
          allowClear
        />
        <Button type="primary" onClick={() => { setPage(1); fetchEntries(); }}>查询</Button>
      </Space>

      <Spin spinning={loading}>
        {entries.length === 0 ? (
          <Empty description="暂无匹配的工作内容记录" />
        ) : (
          <>
            {viewMode === 'card' ? renderCards() : renderTable()}
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Pagination
                current={page}
                total={total}
                pageSize={12}
                onChange={p => setPage(p)}
                showTotal={t => `共 ${t} 条`}
              />
            </div>
          </>
        )}
      </Spin>

      <Drawer
        title="工作详情"
        width={640}
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); setEditing(false); }}
        extra={
          !editing && (
            <Space>
              <Button icon={<EditOutlined />} onClick={() => {
                setEditing(true);
                editForm.setFieldsValue({
                  description: selectedEntry?.description,
                  category: selectedEntry?.category,
                  workDate: selectedEntry ? dayjs(selectedEntry.work_date) : undefined,
                });
              }}>编辑</Button>
              <Button onClick={() => selectedEntry && handleRecategorize(selectedEntry.id)}>重新分类</Button>
              <Popconfirm title="确定删除？此操作不可恢复。" onConfirm={() => selectedEntry && handleDelete(selectedEntry.id)}>
                <Button danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </Space>
          )
        }
      >
        {selectedEntry && (
          editing ? (
            <Form form={editForm} layout="vertical">
              <Form.Item label="工作日期" name="workDate">
                <DatePicker />
              </Form.Item>
              <Form.Item label="分类" name="category">
                <Select>
                  {categories.map(c => (
                    <Select.Option key={c.id} value={c.name}>{c.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="工作描述" name="description" rules={[{ required: true }]}>
                <Input.TextArea rows={6} />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" onClick={handleEditSave}>保存</Button>
                  <Button onClick={() => setEditing(false)}>取消</Button>
                </Space>
              </Form.Item>
            </Form>
          ) : (
            <>
              <Space style={{ marginBottom: 16 }}>
                <Tag color={getCategoryColor(selectedEntry.category)}>{selectedEntry.category}</Tag>
                <Text type="secondary">{selectedEntry.work_date}</Text>
                <Text type="secondary">上传者: {selectedEntry.creator_name}</Text>
              </Space>
              <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 24 }}>{selectedEntry.description}</Paragraph>
              {selectedEntry.images && selectedEntry.images.length > 0 && (
                <Image.PreviewGroup>
                  <Row gutter={[8, 8]}>
                    {selectedEntry.images.map(img => (
                      <Col key={img.id} span={12}>
                        <Image
                          src={normalizePath(img.storedPath)}
                          alt={img.originalName}
                          style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }}
                          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                        />
                      </Col>
                    ))}
                  </Row>
                </Image.PreviewGroup>
              )}
            </>
          )
        )}
      </Drawer>

      <Modal
        title="导出相关照片"
        open={photoModalOpen}
        onOk={handleExportPhotos}
        onCancel={() => { setPhotoModalOpen(false); setPhotoPrefix(''); }}
        confirmLoading={exporting}
        okText="确认导出"
        cancelText="取消"
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="文件名前缀" required help='所有照片将按照 前缀_001、前缀_002... 的格式命名'>
            <Input
              placeholder="例如：安全检查、环境整治照片..."
              value={photoPrefix}
              onChange={e => setPhotoPrefix(e.target.value)}
              maxLength={30}
            />
          </Form.Item>
          <Typography.Text type="secondary">
            已选中 {selectedIds.length} 条工作内容，将导出其中所有关联的照片。
          </Typography.Text>
        </Form>
      </Modal>
    </div>
  );
};

export default BrowsePage;
