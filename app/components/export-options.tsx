/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { saveAs } from 'file-saver'
import html2canvas from 'html2canvas-pro'
import JSZip from 'jszip'
import { useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'

import type { Program } from '~/lib/animation'
import { InputButton } from '~/lib/ui/src'
import { InputSelect } from '~/lib/ui/src/components/InputSelect/InputSelect'

import { type SourceType } from './ascii-art-generator'
import { getContent, type AnimationController } from './ascii-preview'
import { Container } from './container'

export type ExportFormat = 'frames' | 'png' | 'svg'
export type ExportScale = '1x' | '2x' | '3x' | '4x'

interface ExportOptionsProps {
  program: Program | null
  sourceType: SourceType
  animationController: AnimationController
  animationLength: number
  isExporting: boolean
  setIsExporting: (exporting: boolean) => void
  dimensions: { width: number; height: number }
  gridType?: 'none' | 'horizontal' | 'vertical' | 'both'
  disabled: boolean
}

export function ExportOptions({
  program,
  sourceType,
  animationController,
  animationLength,
  isExporting,
  setIsExporting,
  dimensions,
  disabled,
}: ExportOptionsProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>(
    sourceType === 'code' ? 'frames' : 'png',
  )
  const [exportScale, setExportScale] = useState<ExportScale>('2x')

  useEffect(() => {
    if (sourceType === 'code') {
      setExportFormat('frames')
    } else if (exportFormat === 'frames') {
      setExportFormat('png')
    }
  }, [sourceType, exportFormat])

  const exportContent = async () => {
    if (!program) return

    const isAnimated =
      (sourceType === 'code' || sourceType === 'gif' || sourceType === 'video') &&
      animationController
    const totalFrames = isAnimated ? animationLength : 1
    try {
      setIsExporting(true)

      // Pause animation during export if animated
      let wasPlaying = false
      if (isAnimated && animationController) {
        wasPlaying = animationController.getState().playing
        animationController.togglePlay(false)
      }

      // Store current frame to restore later
      const currentFrame =
        isAnimated && animationController ? animationController.getState().frame : 0

      if (totalFrames === 1) {
        await exportSingleFrame()
      } else {
        await exportAnimationFrames(totalFrames, currentFrame, wasPlaying)
      }
    } catch (error) {
      console.error('Error exporting frames:', error)
      toast('An error occurred while exporting')
    } finally {
      setIsExporting(false)
    }
  }

  const exportSingleFrame = async () => {
    toast('Preparing image...')

    // Allow DOM to update
    await new Promise((resolve) => setTimeout(resolve, 50))

    if (exportFormat === 'svg') {
      await exportAsSvg()
    } else {
      await exportAsPng()
    }
  }

  const exportAsPng = async () => {
    const canvas = await captureFrame()
    if (!canvas) return

    canvas.toBlob(
      (blob) => {
        if (blob) saveAs(blob, 'ascii-art.png')
      },
      'image/png',
      1.0,
    )

    toast('Frame has been exported as PNG')
  }

  const generateSvgContent = () => {
    const asciiElement = document.querySelector('.ascii-animation pre')

    if (!asciiElement) {
      toast('Could not find ASCII content')
      return null
    }

    try {
      const { width, height } = dimensions
      const formattedText = getContent(dimensions)?.split('\n') || []

      const fontSize = 12
      const cellHeight = fontSize * 1.2
      const svgHeight = height * cellHeight

      const testSpan = document.createElement('span')
      testSpan.innerText = 'X'.repeat(10)
      testSpan.style.fontFamily = 'GT America Mono, monospace'
      testSpan.style.fontSize = fontSize + 'px'
      testSpan.style.position = 'absolute'
      testSpan.style.visibility = 'hidden'
      document.body.appendChild(testSpan)
      const actualCharWidth = testSpan.getBoundingClientRect().width / 10
      document.body.removeChild(testSpan)

      const measuredCellWidth = actualCharWidth
      const svgWidth = width * measuredCellWidth

      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">\n`
      svgContent += '  <style>\n'
      svgContent += `    .ascii-text { font-family: GT America Mono, monospace; font-size: ${fontSize}px; letter-spacing: 0; white-space: pre; }\n`
      svgContent +=
        '    .grid-line { stroke: #666666; stroke-width: 0.5; stroke-opacity: 0.5; }\n'
      svgContent += '  </style>\n'
      svgContent += '  <rect width="100%" height="100%" fill="transparent"/>\n'

      const gridElement = document.querySelector('.grid-overlay')
      const gridType = gridElement?.getAttribute('data-grid-type') || 'none'

      if (gridType !== 'none') {
        svgContent += '  <!-- Grid overlay -->\n'
        svgContent += '  <g class="grid">\n'

        if (gridType === 'horizontal' || gridType === 'both') {
          for (let i = 1; i < height; i++) {
            const y = i * cellHeight
            svgContent += `    <line class="grid-line" x1="0" y1="${y}" x2="${svgWidth}" y2="${y}" />\n`
          }
        }

        if (gridType === 'vertical' || gridType === 'both') {
          for (let i = 1; i < width; i++) {
            const x = i * measuredCellWidth
            svgContent += `    <line class="grid-line" x1="${x}" y1="0" x2="${x}" y2="${svgHeight}" />\n`
          }
        }

        svgContent += '  </g>\n'
      }

      svgContent += `  <text x="0" y="${fontSize}" class="ascii-text">\n`

      formattedText.forEach((line, index) => {
        // Replace regular spaces with non-breaking spaces to preserve spacing
        const processedLine = line.replace(/ /g, '\u00A0') // Unicode non-breaking space
        svgContent += `    <tspan x="0" dy="${index === 0 ? 0 : cellHeight}">${escapeXml(processedLine)}</tspan>\n`
      })

      svgContent += '  </text>\n'
      svgContent += '</svg>'

      return svgContent
    } catch (error) {
      console.error('Error creating SVG:', error)
      toast('Error creating SVG file')
      return null
    }
  }

  const exportAsSvg = async () => {
    const svgContent = generateSvgContent()
    if (!svgContent) return

    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    saveAs(blob, 'ascii-art.svg')

    toast('Exported as SVG')
  }

  const copySvg = async () => {
    if (!program) return

    try {
      setIsExporting(true)

      // Allow DOM to update
      await new Promise((resolve) => setTimeout(resolve, 50))

      const svgContent = generateSvgContent()
      if (!svgContent) return

      // Copy SVG content to clipboard
      await navigator.clipboard.writeText(svgContent)

      toast('SVG has been copied to clipboard')
    } catch (error) {
      console.error('Error copying SVG to clipboard:', error)
      toast('Failed to copy SVG to clipboard')
    } finally {
      setIsExporting(false)
    }
  }

  // Convert ASCII data to text with line breaks and copy to clipboard
  // Adds line breaks based on column width
  const copyText = () => {
    if (!program) return

    try {
      navigator.clipboard.writeText(getContent(dimensions) || '').then(() => {
        toast('ASCII art has been copied to your clipboard')
      })
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      toast('Could not copy to clipboard')
    }
  }

  const escapeXml = (unsafe: string) => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<':
          return '&lt;'
        case '>':
          return '&gt;'
        case '&':
          return '&amp;'
        case "'":
          return '&apos;'
        case '"':
          return '&quot;'
        default:
          return c
      }
    })
  }

  const exportAnimationFrames = async (
    totalFrames: number,
    currentFrame: number,
    wasPlaying: boolean,
  ) => {
    const zip = new JSZip()

    for (let i = 0; i < totalFrames; i++) {
      if (animationController) {
        animationController.setFrame(i)
      }

      // Allow DOM to update
      await new Promise((resolve) => setTimeout(resolve, 50))

      const canvas = await captureFrame()
      if (!canvas) continue

      // Convert canvas to blob and add to zip
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b as Blob), 'image/png', 1.0),
      )

      zip.file(`frame_${String(i).padStart(4, '0')}.png`, blob)

      if (i % 5 === 0 || i === totalFrames - 1) {
        toast.loading(`Exporting frames: ${Math.round(((i + 1) / totalFrames) * 100)}%`, {
          id: 'export-progress',
        })
      }
    }

    // Restore animation state
    if (animationController) {
      animationController.setFrame(currentFrame)
      if (wasPlaying) {
        animationController.togglePlay(true)
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    saveAs(zipBlob, 'ascii-animation-frames.zip')

    toast.success('Export complete!', { id: 'export-progress' })
  }

  // The ASCII is HTML so we need some way to turn it into an image
  const captureFrame = async () => {
    const asciiParent = document.querySelector('.ascii-animation')?.parentElement
    if (!asciiParent) return null

    // Contains both the ASCII and grid overlay
    const containerElement = asciiParent

    // Convert scale string to number (e.g., '2x' -> 2)
    const scaleValue = parseInt(exportScale.replace('x', ''))

    return html2canvas(containerElement as HTMLElement, {
      backgroundColor: 'transparent',
      scale: scaleValue,
      logging: false,
      allowTaint: true,
      useCORS: true,
      removeContainer: false,
      onclone: (document) => {
        // Find elements with CSS color functions and simplify them
        const elements = document.querySelectorAll('*')
        elements.forEach((el) => {
          const style = window.getComputedStyle(el)
          const color = style.color
          if (color.includes('color(')) {
            // Set to a basic color that html2canvas can handle
            ;(el as HTMLElement).style.color = 'currentColor'
          }
        })
      },
    })
  }

  useEffect(() => {
    const isAnimated =
      sourceType === 'code' || sourceType === 'gif' || sourceType === 'video'
    if (isAnimated && animationLength > 1) {
      setExportFormat('frames')
    } else {
      setExportFormat('svg')
    }
  }, [sourceType, animationLength])

  // Copy with cmd+c
  useHotkeys('meta+c', () => copyText(), { preventDefault: true }, [])

  // Copy svg with ctrl+shift+c
  useHotkeys('ctrl+shift+c', () => copySvg(), { preventDefault: true }, [])

  return (
    <Container>
      <InputSelect
        value={exportFormat}
        onChange={(value) => setExportFormat(value as ExportFormat)}
        options={
          (sourceType === 'code' || sourceType === 'gif') && animationLength > 1
            ? (['frames'] as ExportFormat[])
            : (['svg', 'png'] as ExportFormat[])
        }
        labelize={(format) => (format === 'frames' ? 'PNGs' : format.toUpperCase())}
        disabled={isExporting}
      >
        Format
      </InputSelect>
      {exportFormat !== 'svg' && (
        <InputSelect
          value={exportScale}
          onChange={(value) => setExportScale(value as ExportScale)}
          options={['1x', '2x', '3x', '4x']}
          disabled={isExporting}
        >
          Quality
        </InputSelect>
      )}
      <div className="space-y-2">
        <InputButton
          variant="secondary"
          className="mt-2 w-full"
          onClick={exportContent}
          disabled={isExporting || disabled}
        >
          {sourceType === 'code' || sourceType === 'gif' || sourceType === 'video'
            ? `Export ${exportFormat === 'frames' ? 'Frames' : 'Frame'}`
            : 'Export Image'}
        </InputButton>

        <div className="flex gap-2">
          <InputButton
            variant="secondary"
            onClick={copyText}
            disabled={isExporting || disabled}
          >
            Copy text
          </InputButton>

          <InputButton
            variant="secondary"
            onClick={copySvg}
            disabled={isExporting || disabled}
          >
            Copy SVG
          </InputButton>
        </div>
      </div>
    </Container>
  )
}
