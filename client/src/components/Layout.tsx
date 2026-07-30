import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Typography, theme, Modal, Input, Form, message } from 'antd';
import {
  UploadOutlined,
  SearchOutlined,
  BarChartOutlined,
  FileTextOutlined,
  TagOutlined,
  UserOutlined,
  LogoutOutlined,
  AppstoreOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuth } from '../hooks/useAuth';
import { useUnit } from '../hooks/useUnit';
import api from '../services/api';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const AppLayout: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const { appTitle, appShortTitle } = useUnit();
  useEffect(() => { document.title = appTitle; }, [appTitle]);
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm] = Form.useForm();
  const { token: themeToken } = theme.useToken();

  const sideMenuItems: MenuProps['items'] = [
    {
      key: 'archive',
      icon: <AppstoreOutlined />,
      label: '工作内容归档',
      children: [
        { key: '/archive/upload', icon: <UploadOutlined />, label: '内容上传' },
        { key: '/archive/browse', icon: <SearchOutlined />, label: '内容浏览' },
        ...(isAdmin ? [
          { key: '/archive/stats', icon: <BarChartOutlined />, label: '数据统计' },
          { key: '/archive/draft', icon: <FileTextOutlined />, label: '信息稿生成' },
        ] : []),
      ],
    },
    ...(isAdmin ? [{
      key: 'manage',
      icon: <UserOutlined />,
      label: '系统管理',
      children: [
        { key: '/categories', icon: <TagOutlined />, label: '分类管理' },
        { key: '/users', icon: <UserOutlined />, label: '用户管理' },
        { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
      ],
    }] : []),
  ];

  const getSelectedKeys = () => {
    const path = location.pathname;
    if (path.startsWith('/archive')) {
      if (path.includes('/browse')) return ['/archive/browse'];
      if (path.includes('/stats')) return ['/archive/stats'];
      if (path.includes('/draft')) return ['/archive/draft'];
      return ['/archive/upload'];
    }
    if (path.startsWith('/categories')) return ['/categories'];
    if (path.startsWith('/users')) return ['/users'];
    if (path.startsWith('/settings')) return ['/settings'];
    return ['/archive/upload'];
  };

  const getOpenKeys = () => {
    if (location.pathname.startsWith('/archive')) return ['archive'];
    if (location.pathname.startsWith('/categories') || location.pathname.startsWith('/users') || location.pathname.startsWith('/settings')) return ['manage'];
    return ['archive'];
  };

  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      if (values.newPassword !== values.confirmPassword) {
        message.error('两次输入的新密码不一致');
        return;
      }
      await api.put('/auth/change-password', { oldPassword: values.oldPassword, newPassword: values.newPassword });
      message.success('密码修改成功');
      setPasswordModalOpen(false);
      passwordForm.resetFields();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.error || '修改失败');
    }
  };

  const userMenuItems: MenuProps['items'] = [
    { key: 'info', label: `${user?.displayName} (${user?.role === 'admin' ? '管理员' : '工作人员'})`, disabled: true },
    { type: 'divider' },
    { key: 'changePassword', icon: <UserOutlined />, label: '修改密码', onClick: () => setPasswordModalOpen(true) },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: () => { logout(); navigate('/login'); } },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={220}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
          <Text strong style={{ color: '#fff', fontSize: collapsed ? 14 : 18, whiteSpace: 'nowrap' }}>
            {collapsed ? appShortTitle.substring(0, 2) : appTitle}
          </Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getOpenKeys()}
          items={sideMenuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: themeToken.colorBgContainer,
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
          height: 64,
        }}>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: themeToken.colorPrimary }} />
              <Text>{user?.displayName}</Text>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, background: themeToken.colorBgContainer, borderRadius: 8, padding: 24, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
      <Modal
        title="修改密码"
        open={passwordModalOpen}
        onOk={handleChangePassword}
        onCancel={() => { setPasswordModalOpen(false); passwordForm.resetFields(); }}
        destroyOnClose
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item label="旧密码" name="oldPassword" rules={[{ required: true, message: '请输入旧密码' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label="新密码" name="newPassword" rules={[{ required: true, min: 6, max: 20, message: '密码长度6-20位' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的新密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default AppLayout;
