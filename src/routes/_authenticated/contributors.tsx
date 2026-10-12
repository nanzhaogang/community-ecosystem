import { createFileRoute } from '@tanstack/react-router'
import { ContributorsAnalysis } from '@/features/community/contributors'
import { timeRangeSearchSchema } from '@/lib/monitor/ranges'

export const Route = createFileRoute('/_authenticated/contributors')({
  validateSearch: timeRangeSearchSchema,
  component: ContributorsAnalysis,
})