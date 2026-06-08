import { useLayoutEffect, useRef, useState } from 'react'

export default function MeasuredChart({ children, height = 256 }) {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined

    let frame = 0
    const update = () => {
      frame = 0
      const nextWidth = Math.floor(element.getBoundingClientRect().width)
      setWidth((current) => (nextWidth > 0 && nextWidth !== current ? nextWidth : current))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    schedule()
    const observer = new ResizeObserver(schedule)
    observer.observe(element)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return (
    <div ref={ref} className="min-w-0" style={{ height }}>
      {width > 0 ? children({ width, height }) : null}
    </div>
  )
}
