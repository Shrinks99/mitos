import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'

interface AnimationOptionsProps {
  settings: {
    animationLength: number
    frameRate: number
  }
  updateSettings: (
    settings: Partial<{
      animationLength: number
      frameRate: number
    }>,
  ) => void
}

export function AnimationOptions({ settings, updateSettings }: AnimationOptionsProps) {
  return (
    <div>
      <h3 className="mb-4 text-lg font-medium">Animation Options</h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="animationLength">Animation Length (frames)</Label>
            <span className="text-sm text-muted-foreground">
              {settings.animationLength}
            </span>
          </div>
          <Input
            id="animationLength"
            type="number"
            min={1}
            value={settings.animationLength}
            onChange={(e) =>
              updateSettings({ animationLength: Number.parseInt(e.target.value) || 1 })
            }
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="frameRate">Frame Rate (FPS)</Label>
            <span className="text-sm text-muted-foreground">{settings.frameRate}</span>
          </div>
          <Input
            id="frameRate"
            type="number"
            min={1}
            max={60}
            value={settings.frameRate}
            onChange={(e) =>
              updateSettings({ frameRate: Number.parseInt(e.target.value) || 1 })
            }
          />
        </div>
      </div>
    </div>
  )
}
