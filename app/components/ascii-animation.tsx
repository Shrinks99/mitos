/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { useEffect, useRef } from 'react'

import { createAnimation, type Program } from '~/lib/animation'

import { AnimationController } from './ascii-preview'

export default function AsciiAnimation({
  program,
  onFrameUpdate = undefined,
  maxFrames,
  animationController,
  setAnimationController,
}: {
  program: Program
  onFrameUpdate?: (frame: number) => void
  maxFrames?: number
  animationController?: AnimationController
  setAnimationController: (controller: AnimationController) => void
}) {
  const asciiEl = useRef<HTMLPreElement>(null)
  const controllerRef = useRef(animationController)

  useEffect(() => {
    controllerRef.current = animationController
  }, [animationController])

  // Force re-initialization when component mounts or program changes
  useEffect(() => {
    if (!asciiEl.current) return

    // Use the ref to access the current controller
    const currentController = controllerRef.current

    const wasPlaying = currentController ? currentController.getState().playing : false
    const currentFrame = currentController ? currentController.getState().frame : 0

    // Clean up previous animation controller
    if (currentController) {
      currentController.cleanup()
      setAnimationController(null)
    }

    try {
      const animController = createAnimation(program, {
        element: asciiEl.current,
        onFrameUpdate: onFrameUpdate ? onFrameUpdate : undefined,
        maxFrames,
      })

      animController.togglePlay(wasPlaying)
      animController.setFrame(currentFrame)

      setAnimationController(animController)
    } catch (error) {
      console.error('Error creating animation controller:', error)
    }
  }, [program, maxFrames, onFrameUpdate, setAnimationController])

  return (
    <div
      className="ascii-animation relative flex items-center justify-center [font-size:0px]"
      aria-hidden
      role="img"
    >
      <pre
        ref={asciiEl}
        className="pointer-events-none relative m-0 select-none whitespace-pre bg-[transparent] p-0 font-mono leading-[1.2]"
        style={{ fontFamily: '"GT America Mono",monospace', fontSize: '12px' }}
      />
    </div>
  )
}
