import { useState, useEffect } from 'react';
import { Tag, Image, Typography, Button, Input, Spin, message, Space, Empty, Card } from 'antd';
import { FileWordOutlined, ExpandOutlined, SearchOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

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

interface DraftItem {
  id: number;
  original: string;
  expanded: string;
  category: string;
  workDate: string;
  images: { id: number; originalName: string; storedPath: string; thumbPath: string }[];
}

const DraftPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialIds: number[] = (location.state as any)?.selectedIds || [];

  const [items, setItems] = useState<DraftItem[]>([]);
  const [expanding, setExpanding] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (initialIds.length > 0) {
      handleExpand();
    }
  }, []);

  const handleExpand = async () => {
    if (initialIds.length === 0) {
      message.warning('请先从浏览页面勾选要生成信息稿的工作内容');
      return;
    }
    if (initialIds.length > 10) {
      message.warning('最多同时扩写10条工作内容');
      return;
    }
    setExpanding(true);
    try {
      const { data } = await api.post('/draft/expand', { ids: initialIds });
      setItems(data.results);
      message.success(`扩写完成，共 ${data.results.length} 条`);
    } catch (e: any) {
      message.error(e?.response?.data?.error || '扩写失败');
    } finally {
      setExpanding(false);
    }
  };

  const handleExportWord = async () => {
    setExporting(true);
    try {
      const response = await api.post('/draft/word', { items }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `工作信息稿_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('Word文档生成成功');
    } catch (e: any) {
      message.error('生成失败');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>信息稿生成</Title>
        <Space>
          <Button icon={<ExpandOutlined />} loading={expanding} onClick={handleExpand}>
            重新扩写
          </Button>
          <Button type="primary" icon={<FileWordOutlined />} loading={exporting} onClick={handleExportWord} disabled={items.length === 0}>
            导出Word文档
          </Button>
        </Space>
      </div>

      <Spin spinning={expanding}>
        {items.length === 0 ? (
          <Empty description={
            <span>请先从<a onClick={() => navigate('/archive/browse')}>浏览页面</a>勾选工作内容，再进入此页面生成信息稿</span>
          } />
        ) : (
          items.map((item, idx) => (
            <Card key={item.id} style={{ marginBottom: 24 }} title={
              <Space>
                <Tag color={getCategoryColor(item.category)}>{item.category}</Tag>
                <span>{item.workDate}</span>
              </Space>
            }>
              <Typography.Text type="secondary">原始内容：</Typography.Text>
              <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 16, background: '#fafafa', padding: 12, borderRadius: 6 }}>
                {item.original}
              </Paragraph>
              <Typography.Text type="secondary">扩写内容（可编辑）：</Typography.Text>
              <TextArea
                rows={6}
                value={item.expanded}
                onChange={e => {
                  const updated = [...items];
                  updated[idx].expanded = e.target.value;
                  setItems(updated);
                }}
                style={{ marginBottom: 16 }}
              />
              {item.images && item.images.length > 0 && (
                <>
                  <Typography.Text type="secondary">关联图片：</Typography.Text>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {item.images.map(img => (
                      <Image
                        key={img.id}
                        src={normalizePath(img.storedPath)}
                        width={120}
                        height={100}
                        style={{ objectFit: 'cover', borderRadius: 4 }}
                        fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                      />
                    ))}
                  </div>
                </>
              )}
            </Card>
          ))
        )}
      </Spin>
    </div>
  );
};

export default DraftPage;
