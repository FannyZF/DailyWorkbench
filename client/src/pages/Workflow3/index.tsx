import { Result, Button } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const Workflow3Page: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Result
      icon={<ExperimentOutlined />}
      title="工作流3 - 待开发"
      subTitle="此工作流模块已预留，可根据业务需求进行扩展开发。请联系管理员配置新工作流。"
      extra={
        <Button type="primary" onClick={() => navigate('/archive/upload')}>
          返回工作内容归档
        </Button>
      }
    />
  );
};

export default Workflow3Page;
