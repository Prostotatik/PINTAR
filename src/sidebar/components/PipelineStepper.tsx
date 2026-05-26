import { Icon, type IconName } from './Icon'
import type { PipelineStage } from '../../shared/constants'

interface Props {
  stage: PipelineStage
  isRunning: boolean
}

const STEPS: { key: PipelineStage; label: string; icon: IconName }[] = [
  { key: 'stage1', label: 'Screen', icon: 'scan' },
  { key: 'stage2', label: 'Review', icon: 'file-search' },
  { key: 'stage3', label: 'Enrich', icon: 'globe' },
  { key: 'stage4', label: 'Decide', icon: 'scale' },
]

const ORDER: PipelineStage[] = ['stage1', 'stage2', 'stage3', 'stage4']

export function PipelineStepper({ stage, isRunning }: Props) {
  if (stage === 'idle') return null

  const currentIndex = stage === 'done' ? ORDER.length : ORDER.indexOf(stage)

  return (
    <ol className="stepper" aria-label="Recruitment pipeline progress">
      {STEPS.map((step, i) => {
        const done = i < currentIndex
        const active = i === currentIndex && stage !== 'done'
        const state = done ? 'done' : active ? 'active' : 'pending'
        return (
          <li
            key={step.key}
            className={`stepper__step stepper__step--${state}`}
            aria-current={active ? 'step' : undefined}
          >
            <span className="stepper__node">
              {done ? (
                <Icon name="check" size={13} strokeWidth={2.2} />
              ) : (
                <Icon name={step.icon} size={14} />
              )}
              {active && isRunning && <span className="stepper__ping" aria-hidden="true" />}
            </span>
            <span className="stepper__label">{step.label}</span>
            {i < STEPS.length - 1 && <span className="stepper__bar" aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}
