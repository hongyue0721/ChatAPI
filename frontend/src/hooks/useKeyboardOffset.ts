import { useEffect, useState } from 'react'

export function useKeyboardOffset() {
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) {
      setKeyboardOffset(0)
      return
    }

    const viewport = window.visualViewport
    const updateKeyboardOffset = () => {
      const rawOffset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      )
      setKeyboardOffset(rawOffset > 80 ? Math.round(rawOffset) : 0)
    }

    updateKeyboardOffset()
    viewport.addEventListener('resize', updateKeyboardOffset)
    viewport.addEventListener('scroll', updateKeyboardOffset)

    return () => {
      viewport.removeEventListener('resize', updateKeyboardOffset)
      viewport.removeEventListener('scroll', updateKeyboardOffset)
    }
  }, [])

  return keyboardOffset
}
