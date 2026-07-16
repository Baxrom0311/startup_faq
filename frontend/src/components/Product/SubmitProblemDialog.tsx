import { Link } from "@tanstack/react-router"
import { ArrowRight, ImageIcon, Volume2, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  apiMutation,
  fetchRegions,
  fetchSectors,
  type Problem,
  type Region,
  type Sector,
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
  const { t } = useTranslation()
  const [rawText, setRawText] = useState("")
  const [sectorId, setSectorId] = useState<string>("")
  const [regionId, setRegionId] = useState<string>("")
  const [sectors, setSectors] = useState<Sector[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [duplicateProblem, setDuplicateProblem] = useState<Problem | null>(null)

  useEffect(() => {
    fetchSectors()
      .then(setSectors)
      .catch(() => undefined)
    fetchRegions()
      .then(setRegions)
      .catch(() => undefined)
  }, [])

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

  // Reset state when dialog closes/reopens
  useEffect(() => {
    if (!open) {
      setDuplicateProblem(null)
      setSectorId("")
      setRegionId("")
    }
  }, [open])

  const selectAudio = (file?: File) => {
    if (!file) {
      setAudioFile(null)
      return
    }
    if (!AUDIO_TYPES.has(file.type) || file.size > MAX_AUDIO_SIZE) {
      toast.error(t("error_audio_invalid"))
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
        sector_id: sectorId ? Number(sectorId) : null,
        region_id: regionId ? Number(regionId) : null,
      })

      setRawText("")
      setAudioFile(null)
      setPhotoFiles([])

      if (result.is_duplicate) {
        setDuplicateProblem(result)
        return
      }
      onOpenChange(false)
      toast.success(t("submit_success"))
      await onCreated?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error_generic"))
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
            <DialogTitle>{t("submit_duplicate_title")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-muted-foreground text-sm">
              {t("submit_duplicate_desc")}
            </p>
            <div className="rounded-md border bg-muted/40 p-4">
              <p className="truncate text-sm font-medium">
                {duplicateProblem.title ||
                  duplicateProblem.raw_text ||
                  t("unnamed_problem")}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {duplicateProblem.vote_count} {t("votes")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {t("submit_duplicate_close")}
            </Button>
            <Button asChild onClick={() => onOpenChange(false)}>
              <Link
                to="/problems/$problemId"
                params={{ problemId: duplicateProblem.id }}
              >
                {t("submit_duplicate_view")}
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
          <DialogTitle>{t("submit_title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="raw-text">
            {t("submit_text_label")}
          </label>
          <Textarea
            id="raw-text"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder={t("submit_text_placeholder")}
            rows={4}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {sectors.length > 0 && (
            <div className="grid gap-2">
              <span className="text-sm font-medium">
                {t("submit_sector_label")}
              </span>
              <Select value={sectorId} onValueChange={setSectorId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("submit_sector_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((sector) => (
                    <SelectItem key={sector.id} value={String(sector.id)}>
                      {sector.icon}{" "}
                      {t(`sector_${sector.slug}` as any, sector.name_uz)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {regions.length > 0 && (
            <div className="grid gap-2">
              <span className="text-sm font-medium">
                {t("submit_region_label")}
              </span>
              <Select value={regionId} onValueChange={setRegionId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("submit_region_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={String(region.id)}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="audio-file">
            {t("submit_audio_label")}
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
            {t("submit_photo_label")}
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
            {t("submit_cancel")}
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
            {t("submit_send")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
