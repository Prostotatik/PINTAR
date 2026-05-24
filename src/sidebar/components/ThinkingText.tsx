interface Props {
  text: string
}

export function ThinkingText({ text }: Props) {
  return (
    <span className="thinking-text">
      {text}
    </span>
  )
}
