import { Result, Button } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const PlaceholderPage: React.FC<{ title: string; description: string }> = ({ title, description }) => {
  const navigate = useNavigate();
  return (
    <Result
      icon={<ExperimentOutlined />}
      title={title}
      subTitle={description}
      extra={
        <Button type="primary" onClick={() => navigate('/archive/upload')}>
          返回工作内容归档
        </Button>
      }
    />
  );
};

const Workflow2Page: React.FC = () => (
  <PlaceholderPage
    title="工作流2 - 待开发"
    description="此工作流模块已预留，可根据业务需求进行扩展开发。请联系管理员配置新工作流。"
  />
);

export default Workflow2Page;
