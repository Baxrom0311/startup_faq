import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { Textarea } from "@/components/ui/textarea"
import { apiMutation, uploadProblemAudio } from "@/lib/product-api"

type SubmitProblemDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => Promise<void> | void
}

export function SubmitProblemDialog({
  open,
  onOpenChange,
  onCreated,
}: SubmitProblemDialogProps) {
  const [rawText, setRawText] = useState("")
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submitProblem = async () => {
    if (submitting || (rawText.trim().length === 0 && !audioFile)) return
    setSubmitting(true)
    try {
      const rawAudioKey = audioFile ? await uploadProblemAudio(audioFile) : null
      await apiMutation("/problems/", {
        raw_text: rawText.trim() || null,
        raw_audio_key: rawAudioKey,
      })
      setRawText("")
      setAudioFile(null)
      onOpenChange(false)
      toast.success("Muammo qabul qilindi va AI tekshiruvga yuborildi.")
      await onCreated?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xatolik yuz berdi.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Muammo yuborish</DialogTitle>
          <DialogDescription>
            Real vaziyatni yozing yoki audio yuklang. AI uni signalga
            strukturalaydi.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="raw-text">
            Muammo matni
          </label>
          <Textarea
            id="raw-text"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder="Masalan: issiqxonada namlikni doimiy kuzatish qiyin..."
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="audio-file">
            Audio
          </label>
          <Input
            id="audio-file"
            accept="audio/*"
            type="file"
            onChange={(event) => setAudioFile(event.target.files?.[0] || null)}
          />
          {audioFile && (
            <p className="text-muted-foreground truncate text-xs">
              {audioFile.name}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Bekor qilish
          </Button>
          <LoadingButton
            type="button"
            loading={submitting}
            disabled={rawText.trim().length === 0 && !audioFile}
            onClick={submitProblem}
          >
            Yuborish
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
