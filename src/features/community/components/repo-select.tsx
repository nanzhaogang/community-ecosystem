import { repoKey } from '@/lib/monitor/data'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { RepoSummary } from '@/lib/monitor/types'

type RepoSelectProps = {
  repos: RepoSummary[]
  value: string
  onChange: (key: string) => void
}

/** Switch the repository a monitor page is scoped to. Hidden for a single repo. */
export function RepoSelect({ repos, value, onChange }: RepoSelectProps) {
  if (repos.length <= 1) return null

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size='sm'
        className='w-[200px]'
        aria-label='选择仓库'
      >
        <SelectValue placeholder='选择仓库' />
      </SelectTrigger>
      <SelectContent>
        {repos.map((repo) => {
          const key = repoKey(repo)
          return (
            <SelectItem key={key} value={key}>
              {repo.fullName}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}