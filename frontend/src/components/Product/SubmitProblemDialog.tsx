import { Link } from "@tanstack/react-router"
import { ArrowRight, ImageIcon, Volume2, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { Textarea } from "@/components/ui/textarea"
import {
  apiMutation,
  type Problem,
  uploadProblemAudio,
  uploadProblemPhoto,
} from "@/lib/product-api"

type SubmitProblemDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => Promise<void> | void
}

const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
])
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_AUDIO_SIZE = 10 * 1024 * 1024
const MAX_PHOTO_SIZE = 5 * 1024 * 1024

function formatSize(size: number) {
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function SubmitProblemDialog({
  open,
  onOpenChange,
  onCreated,
}: SubmitProblemDialogProps) {
  const [rawText, setRawText] = useState("")
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [duplicateProblem, setDuplicateProblem] = useState<Problem | null>(null)

  const audioPreviewUrl = useMemo(
    () => (audioFile ? URL.createObjectURL(audioFile) : null),
    [audioFile],
  )
  const photoPreviewUrls = useMemo(
    () =>
      photoFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [photoFiles],
  )

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
    }
  }, [audioPreviewUrl])

  useEffect(() => {
    return () => {
      for (const preview of photoPreviewUrls) {
        URL.revokeObjectURL(preview.url)
      }
    }
  }, [photoPreviewUrls])

  // Reset duplicate state when dialog closes/reopens
  useEffect(() => {
    if (!open) {
      setDuplicateProblem(null)
    }
  }, [open])

  const selectAudio = (file?: File) => {
    if (!file) {
      setAudioFile(null)
      return
    }
    if (!AUDIO_TYPES.has(file.type) || file.size > MAX_AUDIO_SIZE) {
      toast.error("Audio")
      return
    }
    setAudioFile(file)
  }

  const selectPhotos = (files: FileList | null) => {
    const validFiles = Array.from(files || []).filter((file) => {
      const valid = PHOTO_TYPES.has(file.type) && file.size <= MAX_PHOTO_SIZE
      if (!valid) toast.error(file.name)
      return valid
    })
    setPhotoFiles(validFiles)
  }

  const submitProblem = async () => {
    if (
      submitting ||
      (rawText.trim().length === 0 && !audioFile && photoFiles.length === 0)
    ) {
      return
    }
    setSubmitting(true)
    try {
      const rawAudioKey = audioFile ? await uploadProblemAudio(audioFile) : null
      const photoKeys = await Promise.all(photoFiles.map(uploadProblemPhoto))
      const result = await apiMutation<Problem>("/problems/", {
        raw_text: rawText.trim() || null,
        raw_audio_key: rawAudioKey,
        photo_keys: photoKeys,
      })

      setRawText("")
      setAudioFile(null)
      setPhotoFiles([])

      if (result.is_duplicate) {
        setDuplicateProblem(result)
        return
      }
      onOpenChange(false)
      toast.success("Sent")
      await onCreated?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    if (duplicateProblem) {
      onCreated?.()
    }
  }

  if (duplicateProblem) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Muammo allaqachon mavjud</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-muted-foreground text-sm">
              Bu muammo allaqachon tizimda mavjud. Ovozingiz unga qo'shildi.
            </p>
            <div className="rounded-md border bg-muted/40 p-4">
              <p className="truncate text-sm font-medium">
                {duplicateProblem.title ||
                  duplicateProblem.raw_text ||
                  "Muammo"}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {duplicateProblem.vote_count} ovoz
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Yopish
            </Button>
            <Button asChild onClick={() => onOpenChange(false)}>
              <Link
                to="/problems/$problemId"
                params={{ problemId: duplicateProblem.id }}
              >
                Ko'rish
                <ArrowRight />
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="raw-text">
            Text
          </label>
          <Textarea
            id="raw-text"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder="Write..."
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
            onChange={(event) => selectAudio(event.target.files?.[0])}
          />
          {audioFile && audioPreviewUrl && (
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Volume2 className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{audioFile.name}</p>
                <audio
                  controls
                  src={audioPreviewUrl}
                  className="mt-2 h-8 w-full"
                >
                  <track kind="captions" />
                </audio>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setAudioFile(null)}
              >
                <X />
              </Button>
            </div>
          )}
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="photo-files">
            Photo
          </label>
          <Input
            id="photo-files"
            accept="image/jpeg,image/png,image/webp"
            multiple
            type="file"
            onChange={(event) => selectPhotos(event.target.files)}
          />
          {photoPreviewUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photoPreviewUrls.map((preview, index) => (
                <div
                  key={`${preview.file.name}-${preview.file.lastModified}`}
                  className="group relative overflow-hidden rounded-md border bg-muted"
                >
                  <img
                    src={preview.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="absolute top-1 right-1 size-7 opacity-95"
                    onClick={() =>
                      setPhotoFiles((files) =>
                        files.filter((_, fileIndex) => fileIndex !== index),
                      )
                    }
                  >
                    <X />
                  </Button>
                  <div className="absolute right-0 bottom-0 left-0 flex items-center gap-1 bg-background/90 px-2 py-1">
                    <ImageIcon className="text-muted-foreground size-3 shrink-0" />
                    <span className="truncate text-[11px]">
                      {formatSize(preview.file.size)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <LoadingButton
            type="button"
            loading={submitting}
            disabled={
              rawText.trim().length === 0 &&
              !audioFile &&
              photoFiles.length === 0
            }
            onClick={submitProblem}
          >
            Send
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
