import { createFileRoute } from "@tanstack/react-router"
import { CheckCircle2, ImagePlus, Mic, Square, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { LoadingButton } from "@/components/ui/loading-button"
import { Textarea } from "@/components/ui/textarea"
import {
  submitCivicAppeal,
  uploadProblemAudio,
  uploadProblemPhoto,
} from "@/lib/product-api"

export const Route = createFileRoute("/_layout/appeal")({
  component: AppealSubmit,
  head: () => ({
    meta: [{ title: "Murojaat - SolutionLab" }],
  }),
})

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_PHOTO_SIZE = 5 * 1024 * 1024
const MAX_RECORD_SECONDS = 120

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function AppealSubmit() {
  const { t } = useTranslation()
  const [rawText, setRawText] = useState("")
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<"ok" | "duplicate" | null>(null)

  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  const audioPreviewUrl = useMemo(
    () => (audioFile ? URL.createObjectURL(audioFile) : null),
    [audioFile],
  )
  const photoPreviews = useMemo(
    () => photoFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photoFiles],
  )

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
    }
  }, [audioPreviewUrl])

  useEffect(() => {
    return () => {
      for (const preview of photoPreviews) URL.revokeObjectURL(preview.url)
    }
  }, [photoPreviews])

  // Clean up recorder/timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop()
      }
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        for (const track of stream.getTracks()) track.stop()
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        const file = new File([blob], `appeal-${Date.now()}.webm`, {
          type: "audio/webm",
        })
        setAudioFile(file)
        setIsRecording(false)
        if (timerRef.current) clearInterval(timerRef.current)
      }
      recorder.start()
      recorderRef.current = recorder
      setIsRecording(true)
      setRecordSeconds(0)
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s + 1 >= MAX_RECORD_SECONDS) recorderRef.current?.stop()
          return s + 1
        })
      }, 1000)
    } catch {
      toast.error(t("audio_record_error"))
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
  }

  const selectPhotos = (files: FileList | null) => {
    const valid = Array.from(files || []).filter((file) => {
      const ok = PHOTO_TYPES.has(file.type) && file.size <= MAX_PHOTO_SIZE
      if (!ok) toast.error(t("error_audio_invalid"))
      return ok
    })
    if (valid.length > 0) setPhotoFiles((prev) => [...prev, ...valid])
  }

  const hasContent =
    rawText.trim().length > 0 || !!audioFile || photoFiles.length > 0

  const submit = async () => {
    if (submitting || !hasContent) return
    setSubmitting(true)
    try {
      const rawAudioKey = audioFile
        ? await uploadProblemAudio(audioFile)
        : undefined
      const photoKeys = await Promise.all(photoFiles.map(uploadProblemPhoto))
      const result = await submitCivicAppeal({
        raw_text: rawText.trim() || undefined,
        raw_audio_key: rawAudioKey,
        photo_keys: photoKeys,
      })

      setRawText("")
      setAudioFile(null)
      setPhotoFiles([])
      setRecordSeconds(0)
      setDone(result.is_duplicate ? "duplicate" : "ok")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error_generic"))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="size-12 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-balance">
          {t("appeal_submit_success")}
        </h1>
        {done === "duplicate" && (
          <p className="text-muted-foreground text-lg text-balance">
            O'xshash murojaat bor — sizniki ham hisobga olindi.
          </p>
        )}
        <Button
          size="lg"
          className="h-14 px-8 text-lg"
          onClick={() => setDone(null)}
        >
          {t("appeal_submit_title")}
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-balance">
          {t("appeal_submit_title")}
        </h1>
        <p className="text-muted-foreground mt-3 text-lg text-balance">
          {t("appeal_submit_hint")}
        </p>
      </div>

      {/* Voice-first: big record button */}
      <Card className="mb-5">
        <CardContent className="flex flex-col items-center gap-4 py-8">
          {isRecording ? (
            <>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="size-28 flex-col gap-2 rounded-full text-base"
                onClick={stopRecording}
              >
                <Square className="size-9 fill-current" />
              </Button>
              <p className="text-destructive text-2xl font-semibold tabular-nums">
                {formatTime(recordSeconds)}
              </p>
              <p className="text-muted-foreground text-sm">
                {t("audio_record_stop")}
              </p>
            </>
          ) : (
            <>
              <Button
                type="button"
                size="lg"
                className="size-28 flex-col gap-2 rounded-full text-base"
                onClick={startRecording}
                disabled={!!audioFile}
              >
                <Mic className="size-10" />
              </Button>
              <p className="text-lg font-medium">{t("appeal_voice")}</p>
            </>
          )}

          {audioFile && audioPreviewUrl && !isRecording && (
            <div className="flex w-full items-center gap-3 rounded-lg border p-3">
              {/* biome-ignore lint/a11y/useMediaCaption: user recording */}
              <audio controls src={audioPreviewUrl} className="h-10 flex-1" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => setAudioFile(null)}
                aria-label={t("audio_record_delete")}
              >
                <X className="size-5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Typing alternative */}
      <Textarea
        value={rawText}
        onChange={(event) => setRawText(event.target.value.slice(0, 5000))}
        placeholder={t("appeal_typing_placeholder")}
        rows={5}
        className="mb-5 text-base"
      />

      {/* Photo */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          selectPhotos(event.target.files)
          event.target.value = ""
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mb-4 h-14 w-full gap-2 text-base"
        onClick={() => photoInputRef.current?.click()}
      >
        <ImagePlus className="size-5" />
        {t("appeal_photo")}
      </Button>

      {photoPreviews.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          {photoPreviews.map((preview, index) => (
            <div
              key={`${preview.file.name}-${preview.file.lastModified}`}
              className="relative overflow-hidden rounded-lg border bg-muted"
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
                className="absolute top-1 right-1 size-8 opacity-95"
                onClick={() =>
                  setPhotoFiles((files) => files.filter((_, i) => i !== index))
                }
                aria-label={t("audio_record_delete")}
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Send */}
      <LoadingButton
        type="button"
        size="lg"
        loading={submitting}
        disabled={!hasContent}
        onClick={submit}
        className="h-16 w-full text-lg font-semibold"
      >
        {t("appeal_submit_send")}
      </LoadingButton>
    </div>
  )
}
