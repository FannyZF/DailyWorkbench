import { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Select, Button, Typography, Spin, Empty, message, Space, Divider } from 'antd';
import { Column, Pie, Line } from '@ant-design/charts';
import dayjs from 'dayjs';
import api from '../../services/api';

const { Title, Paragraph } = Typography;

interface CategoryStat {
  category: string;
  count: number;
}

interface DailyStat {
  work_date: string;
  count: number;
}

const StatsPage: React.FC = () => {
  const [startDate, setStartDate] = useState<string>(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [category, setCategory] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<string>('');

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data.map((c: any) => c.name));
    } catch { /* ignore */ }
  };

  const fetchStats = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const params: Record<string, string> = { startDate, endDate };
      if (category) params.category = category;
      const { data } = await api.get('/stats/count', { params });
      setCategoryStats(data.categoryStats);
      setDailyStats(data.dailyStats);
    } catch { message.error('统计查询失败'); }
    finally { setLoading(false); }
  };

  const generateSummary = async () => {
    if (!startDate || !endDate) return;
    setSummaryLoading(true);
    try {
      const { data } = await api.post('/stats/summary', { startDate, endDate, category });
      setSummary(data.summary);
    } catch (e: any) {
      message.error(e?.response?.data?.error || '生成失败');
    } finally {
      setSummaryLoading(false);
    }
  };

  const exportExcel = async () => {
    if (!startDate || !endDate) return;
    try {
      const params = new URLSearchParams({ startDate, endDate });
      if (category) params.set('category', category);
      const response = await api.get(`/stats/export?${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `统计报表_${startDate}_${endDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('报表下载成功');
    } catch { message.error('导出失败'); }
  };

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchStats(); }, []);

  const columnConfig = {
    data: categoryStats,
    xField: 'category',
    yField: 'count',
    label: { position: 'top' as const, style: { fill: '#666' } },
    xAxis: { label: { autoRotate: false } },
    color: ['#1677ff', '#52c41a', '#fa541c', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911'],
  };

  const pieConfig = {
    data: categoryStats,
    angleField: 'count',
    colorField: 'category',
    radius: 0.8,
    label: { type: 'outer' as const, content: '{name} ({percentage})' },
    legend: { position: 'bottom' as const },
  };

  const lineConfig = {
    data: dailyStats,
    xField: 'work_date',
    yField: 'count',
    point: { size: 5, shape: 'diamond' },
    smooth: true,
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>数据统计</Title>

      <Space wrap style={{ marginBottom: 24 }}>
        <DatePicker
          placeholder="开始日期"
          value={startDate ? dayjs(startDate) : null}
          onChange={d => setStartDate(d ? d.format('YYYY-MM-DD') : '')}
        />
        <DatePicker
          placeholder="结束日期"
          value={endDate ? dayjs(endDate) : null}
          onChange={d => setEndDate(d ? d.format('YYYY-MM-DD') : '')}
        />
        <Select
          placeholder="分类筛选（全部）"
          allowClear
          style={{ minWidth: 150 }}
          value={category || undefined}
          onChange={v => setCategory(v || '')}
        >
          {categories.map(c => (
            <Select.Option key={c} value={c}>{c}</Select.Option>
          ))}
        </Select>
        <Button type="primary" onClick={fetchStats}>查询</Button>
        <Button onClick={exportExcel}>导出Excel</Button>
      </Space>

      <Spin spinning={loading}>
        {categoryStats.length === 0 ? (
          <Empty description="所选时间段内暂无工作记录" />
        ) : (
          <>
            <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
              <Col xs={24} lg={12}>
                <Card title="各类工作次数对比">
                  <div style={{ height: 300 }}>
                    <Column {...columnConfig} />
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card title="工作量占比">
                  <div style={{ height: 300 }}>
                    <Pie {...pieConfig} />
                  </div>
                </Card>
              </Col>
            </Row>
            <Card title="每日工作趋势" style={{ marginBottom: 24 }}>
              <div style={{ height: 300 }}>
                <Line {...lineConfig} />
              </div>
            </Card>

            <Divider />
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Button type="primary" size="large" loading={summaryLoading} onClick={generateSummary}>
                自动生成总结
              </Button>
            </div>
            {summary && (
              <Card>
                <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: 2, fontSize: 14 }}>
                  {summary}
                </Paragraph>
                <Button onClick={() => navigator.clipboard.writeText(summary)} style={{ marginTop: 8 }}>
                  复制总结
                </Button>
              </Card>
            )}
          </>
        )}
      </Spin>
    </div>
  );
};

export default StatsPage;
