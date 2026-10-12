import {
  Activity,
  CircleDot,
  GitPullRequest,
  Globe,
  LayoutDashboard,
  LineChart,
  Users,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  teams: [
    {
      name: 'AI应用与软件创新Lab',
      logo: Activity,
      plan: '开源社区运营与健康度监控平台',
    },
  ],
  navGroups: [
    {
      title: '',
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
  ],
}