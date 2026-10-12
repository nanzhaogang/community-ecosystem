import {
  Activity,
  CircleDot,
  GitPullRequest,
  Globe,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  Settings,
  UserCog,
  Users,
  Palette,
  Bell,
  Monitor,
  Wrench,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'oss-monitor',
    email: 'monitor@local',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: '社区监控',
      logo: Activity,
      plan: 'GitHub 开源洞察',
    },
  ],
  navGroups: [
    {
      title: '监控',
      items: [
        {
          title: '社区概览',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Pull Requests',
          url: '/pulls',
          icon: GitPullRequest,
        },
        {
          title: 'Issues',
          url: '/issues',
          icon: CircleDot,
        },
        {
          title: '增长趋势',
          url: '/growth',
          icon: LineChart,
        },
        {
          title: '贡献者',
          url: '/contributors',
          icon: Users,
        },
        {
          title: '生态影响力',
          url: '/ecosystem',
          icon: Globe,
        },
      ],
    },
    {
      title: '其他',
      items: [
        {
          title: '设置',
          icon: Settings,
          items: [
            {
              title: '个人资料',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: '账户',
              url: '/settings/account',
              icon: Wrench,
            },
            {
              title: '外观',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: '通知',
              url: '/settings/notifications',
              icon: Bell,
            },
            {
              title: '显示',
              url: '/settings/display',
              icon: Monitor,
            },
          ],
        },
        {
          title: '帮助中心',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}