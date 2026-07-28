import { createFileRoute } from "@tanstack/react-router"
import {
  Bot,
  CheckCircle2,
  ImagePlus,
  MapPin,
  Mic,
  MicOff,
  Phone,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  User,
  Volume2,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { LoadingButton } from "@/components/ui/loading-button"
import { Textarea } from "@/components/ui/textarea"
import {
  speakAppeal,
  submitCivicAppeal,
  transcribeAppeal,
  uploadProblemAudio,
  uploadProblemPhoto,
  voiceChatAppeal,
  type VoiceChatMessage,
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

type AiState = "idle" | "speaking" | "listening" | "processing" | "done"

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

// Declare SpeechRecognition interface for TypeScript
declare global {
  interface Window {
    // biome-ignore lint/suspicious/noExplicitAny: Browser Web Speech API
    SpeechRecognition: any
    // biome-ignore lint/suspicious/noExplicitAny: Browser Web Speech API
    webkitSpeechRecognition: any
  }
}

function AppealSubmit() {
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState<"voice_ai" | "standard">("voice_ai")

  // Standard Form State
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

  // Voice AI Assistant State
  const [aiState, setAiState] = useState<AiState>("idle")
  const [chatMessages, setChatMessages] = useState<VoiceChatMessage[]>([])
  const [liveTranscript, setLiveTranscript] = useState("")
  const [manualInput, setManualInput] = useState("")
  const [collectedData, setCollectedData] = useState<{
    citizen_name?: string
    phone?: string
    location?: string
    problem_description?: string
  }>({})

  // Speech Recognition & Gemini Audio Ref
  // biome-ignore lint/suspicious/noExplicitAny: Web Speech API ref
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const micStreamRef = useRef<MediaStream | null>(null)
  const liveTranscriptRef = useRef("")
  const chatMessagesRef = useRef<VoiceChatMessage[]>([])


  useEffect(() => {
    chatMessagesRef.current = chatMessages
  }, [chatMessages])

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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop()
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // ── Speech Synthesis (Gemini Native Uzbek TTS Audio) ─────────────────────
  const speakText = async (text: string, onEnd?: () => void) => {
    const lang = i18n.language?.slice(0, 2) ?? "uz"
    setAiState("speaking")

    const finish = () => {
      setAiState("idle")
      if (onEnd) onEnd()
    }

    try {
      const audioBlob = await speakAppeal(text)
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        finish()
      }
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl)
        fallbackSpeechSynthesis(text, lang, finish)
      }
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          URL.revokeObjectURL(audioUrl)
          fallbackSpeechSynthesis(text, lang, finish)
        })
      }
    } catch {
      fallbackSpeechSynthesis(text, lang, finish)
    }
  }

  const fallbackSpeechSynthesis = (
    text: string,
    lang: string,
    finish: () => void,
  ) => {
    if (!("speechSynthesis" in window)) {
      finish()
      return
    }
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang =
        lang === "ru" ? "ru-RU" : lang === "en" ? "en-US" : "uz-UZ"
      utterance.rate = 0.95
      utterance.onend = finish
      utterance.onerror = finish

      const voices = window.speechSynthesis.getVoices()
      const bestVoice = voices.find(
        (v) =>
          v.lang.startsWith(lang) ||
          v.lang.includes("uz") ||
          v.lang.includes("tr"),
      )
      if (bestVoice) utterance.voice = bestVoice

      window.speechSynthesis.speak(utterance)
    } catch {
      finish()
    }
  }



  // ── Speech Recognition & Gemini Audio Transcribe (STT) ───────────────────
  const startListening = async () => {

    setLiveTranscript("")
    liveTranscriptRef.current = ""
    audioChunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm"
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        micStreamRef.current?.getTracks().forEach((t) => t.stop())
        micStreamRef.current = null
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })

        let transcribedText = liveTranscriptRef.current.trim()

        if (blob.size > 1000) {
          try {
            setAiState("processing")
            const buffer = await blob.arrayBuffer()
            const base64 = btoa(
              new Uint8Array(buffer).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                "",
              ),
            )
            const geminiText = await transcribeAppeal(base64, "audio/webm")
            if (geminiText.trim()) {
              transcribedText = geminiText.trim()
            }
          } catch {
            // Keep web speech transcript fallback
          }
        }

        if (transcribedText) {
          handleSendMessage(transcribedText)
        } else {
          setAiState("idle")
        }
      }

      recorder.start()
      setAiState("listening")
    } catch {
      toast.error("Mikrofonga ruxsat berilmadi.")
      setAiState("idle")
      return
    }

    // Also start browser Web Speech API for real-time live preview
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) recognitionRef.current.stop()
        const recognition = new SpeechRecognition()
        const lang = i18n.language?.slice(0, 2)
        recognition.lang =
          lang === "ru" ? "ru-RU" : lang === "en" ? "en-US" : "uz-UZ"
        recognition.continuous = false
        recognition.interimResults = true

        // biome-ignore lint/suspicious/noExplicitAny: Web Speech API event
        recognition.onresult = (event: any) => {
          let transcript = ""
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript
          }
          setLiveTranscript(transcript)
          liveTranscriptRef.current = transcript
        }

        recognitionRef.current = recognition
        recognition.start()
      } catch {
        /* Web speech fallback ignored */
      }
    }
  }

  const stopListening = () => {


    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop()
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setAiState("idle")
  }



  // ── Start Voice AI Assistant Session ──────────────────────────────────────
  const startVoiceAiSession = () => {
    const greeting =
      t("voice_ai_greeting") ||
      "Assalomu aleykum hurmatli fuqaro! Sizning qanday murojaatingiz bor?"
    const initialMsg: VoiceChatMessage = {
      role: "assistant",
      content: greeting,
    }
    setChatMessages([initialMsg])
    setCollectedData({})
    speakText(greeting, () => {
      // Automatically start listening after AI greeting
      startListening()
    })
  }

  // ── Handle User Input (Speech or Typed) ───────────────────────────────────
  const handleSendMessage = async (userText: string) => {
    if (!userText.trim() || aiState === "processing") return

    const newHistory: VoiceChatMessage[] = [
      ...chatMessagesRef.current,
      { role: "user", content: userText.trim() },
    ]
    setChatMessages(newHistory)
    setLiveTranscript("")
    liveTranscriptRef.current = ""
    setManualInput("")
    setAiState("processing")

    try {
      const res = await voiceChatAppeal(
        newHistory,
        i18n.language?.slice(0, 2) ?? "uz",
      )

      if (res.collected_data) {
        setCollectedData((prev) => ({
          ...prev,
          ...res.collected_data,
        }))
      }

      const updatedHistory: VoiceChatMessage[] = [
        ...newHistory,
        { role: "assistant", content: res.reply_text },
      ]
      setChatMessages(updatedHistory)

      if (res.ready_to_submit && res.collected_data?.problem_description) {
        // AI has gathered all details -> submit appeal!
        setSubmitting(true)
        const summaryText = `[AI Murojaat]
Ism: ${res.collected_data.citizen_name || "Ko'rsatilmadi"}
Tel: ${res.collected_data.phone || "Ko'rsatilmadi"}
Manzil: ${res.collected_data.location || "Ko'rsatilmadi"}

Muammo:
${res.collected_data.problem_description}`

        const submissionResult = await submitCivicAppeal({
          raw_text: summaryText,
        })
        setSubmitting(false)
        setDone(submissionResult.is_duplicate ? "duplicate" : "ok")
        setAiState("done")

        speakText(res.reply_text)
      } else {
        // Speak AI reply and then listen again
        speakText(res.reply_text, () => {
          setTimeout(() => {
            startListening()
          }, 300)
        })
      }
    } catch {
      setAiState("idle")
      toast.error(t("error_generic"))
    }
  }

  // ── Standard Form Handlers ────────────────────────────────────────────────
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

  const submitStandard = async () => {
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

  // ── Success State ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="flex size-24 items-center justify-center rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
          <CheckCircle2 className="size-16 animate-bounce" />
        </div>
        <h1 className="text-3xl font-extrabold text-balance">
          {t("appeal_submit_success")}
        </h1>
        {done === "duplicate" ? (
          <p className="text-muted-foreground text-lg text-balance">
            O'xshash murojaat allaqachon mavjud — sizning murojaatingiz ham
            tizimda ro'yxatga olindi va hisobga qo'shildi.
          </p>
        ) : (
          <p className="text-muted-foreground text-lg text-balance">
            Murojaatingiz Gemini AI tomonidan tahlil qilindi va ko'rib chiqish
            uchun tegishli davlat idorasiga avtomatik yuborildi.
          </p>
        )}
        <Button
          size="lg"
          className="h-14 px-8 text-lg font-semibold shadow-lg"
          onClick={() => {
            setDone(null)
            setChatMessages([])
            setCollectedData({})
            setAiState("idle")
            setTimeout(() => {
              startVoiceAiSession()
            }, 100)
          }}
        >
          Yangi murojaat yuborish
        </Button>

      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <Sparkles className="size-4 animate-spin text-amber-500" />
          <span>SolutionLab AI Murojaat Tizimi</span>
        </div>
        <h1 className="text-3xl font-extrabold text-balance tracking-tight sm:text-4xl">
          {t("appeal_submit_title")}
        </h1>
        <p className="text-muted-foreground mt-2 text-balance text-base">
          {t("appeal_submit_hint")}
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="mb-8 flex rounded-xl border bg-muted p-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab("voice_ai")
            if (chatMessages.length === 0) startVoiceAiSession()
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all ${
            activeTab === "voice_ai"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bot className="size-5 text-primary" />
          <span>Ovozli AI Yordamchi</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("standard")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all ${
            activeTab === "standard"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mic className="size-5 text-muted-foreground" />
          <span>Standart Ovoz/Matn</span>
        </button>
      </div>

      {/* ── TAB 1: Voice AI Assistant Mode ───────────────────────────────── */}
      {activeTab === "voice_ai" && (
        <div className="space-y-6">
          {/* Animated AI Orb Card */}
          <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-to-b from-background to-muted/40 shadow-xl">
            <CardContent className="flex flex-col items-center gap-6 py-10">
              {/* Glowing Orb */}
              <div className="relative flex items-center justify-center">
                {/* Pulsing rings */}
                {aiState === "speaking" && (
                  <div className="absolute size-36 animate-ping rounded-full bg-cyan-500/20" />
                )}
                {aiState === "listening" && (
                  <div className="absolute size-36 animate-ping rounded-full bg-rose-500/20" />
                )}
                {aiState === "processing" && (
                  <div className="absolute size-36 animate-spin rounded-full border-4 border-amber-500/30 border-t-amber-500" />
                )}

                {/* Core Sphere */}
                <div
                  className={`flex size-28 items-center justify-center rounded-full shadow-2xl transition-all duration-500 ${
                    aiState === "speaking"
                      ? "bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 shadow-cyan-500/50"
                      : aiState === "listening"
                        ? "scale-105 bg-gradient-to-tr from-rose-600 via-red-500 to-amber-500 shadow-rose-500/50"
                        : aiState === "processing"
                          ? "bg-gradient-to-tr from-amber-600 via-yellow-500 to-orange-500 shadow-amber-500/50"
                          : "bg-gradient-to-tr from-indigo-600 via-primary to-purple-600 shadow-primary/40 hover:scale-105"
                  }`}
                >
                  {aiState === "speaking" ? (
                    <Volume2 className="size-12 animate-pulse text-white" />
                  ) : aiState === "listening" ? (
                    <Mic className="size-12 animate-bounce text-white" />
                  ) : aiState === "processing" ? (
                    <RefreshCw className="size-12 animate-spin text-white" />
                  ) : (
                    <Bot className="size-12 text-white" />
                  )}
                </div>
              </div>

              {/* Dynamic Status Text */}
              <div className="text-center">
                <p className="text-xl font-bold">
                  {aiState === "speaking" && (
                    <span className="text-cyan-600 dark:text-cyan-400">
                      {t("voice_ai_speaking")}
                    </span>
                  )}
                  {aiState === "listening" && (
                    <span className="animate-pulse text-rose-600 dark:text-rose-400">
                      {t("voice_ai_listening")}
                    </span>
                  )}
                  {aiState === "processing" && (
                    <span className="text-amber-600 dark:text-amber-400">
                      {t("voice_ai_processing")}
                    </span>
                  )}
                  {aiState === "idle" && (
                    <span className="text-foreground">
                      {chatMessages.length === 0
                        ? t("voice_ai_title")
                        : "Tinglash tayyor"}
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {aiState === "listening"
                    ? "Erkin so'zlang — AI sizni eshitmoqda..."
                    : aiState === "speaking"
                      ? "Ovoz chiqarilmoqda..."
                      : "Mikrofon tugmasini bosib gapiring yoki quyida yozing"}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                {aiState === "listening" ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    className="h-12 gap-2 rounded-full px-6 text-base font-semibold shadow-md"
                    onClick={stopListening}
                  >
                    <MicOff className="size-5" />
                    <span>To'xtatish</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    disabled={aiState === "processing" || aiState === "speaking"}
                    className="h-12 gap-2 rounded-full bg-gradient-to-r from-primary to-indigo-600 px-8 text-base font-semibold text-white shadow-lg hover:from-primary/90 hover:to-indigo-700"
                    onClick={startListening}
                  >
                    <Mic className="size-5" />
                    <span>
                      {chatMessages.length === 0
                        ? t("voice_ai_start")
                        : "Javob berish (Ovoz)"}
                    </span>
                  </Button>
                )}

                {chatMessages.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-12 gap-2 rounded-full px-5 text-sm font-medium"
                    onClick={startVoiceAiSession}
                  >
                    <RefreshCw className="size-4" />
                    <span>Qaytadan boshlash</span>
                  </Button>
                )}
              </div>

              {/* Live Transcript Display */}
              {liveTranscript && (
                <div className="w-full rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-center">
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    Siz aytmoqdasiz:
                  </p>
                  <p className="mt-1 text-base font-medium italic">
                    "{liveTranscript}"
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Collected Citizen Info Card */}
          {(collectedData.citizen_name ||
            collectedData.phone ||
            collectedData.location ||
            collectedData.problem_description) && (
            <Card className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10">
              <CardContent className="py-4">
                <h3 className="mb-3 text-sm font-bold text-amber-700 dark:text-amber-400">
                  📋 AI aniqlagan ma'lumotlar:
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <User className="size-4 text-amber-600" />
                    <span className="font-semibold">Ism:</span>
                    <span>{collectedData.citizen_name || "So'ralmoqda..."}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="size-4 text-amber-600" />
                    <span className="font-semibold">Tel:</span>
                    <span>{collectedData.phone || "So'ralmoqda..."}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="size-4 text-amber-600" />
                    <span className="font-semibold">Manzil:</span>
                    <span>{collectedData.location || "So'ralmoqda..."}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conversation History Chat Log */}
          {chatMessages.length > 0 && (
            <Card className="overflow-hidden border">
              <div className="border-b bg-muted/50 px-4 py-3 text-sm font-bold flex items-center justify-between">
                <span>💬 AI va Fuqaro muloqot tarixi</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {chatMessages.length} ta xabar
                </span>
              </div>
              <CardContent className="max-h-80 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((msg, index) => (
                  <div
                    key={`${msg.role}-${index}-${msg.content.slice(0, 10)}`}
                    className={`flex gap-3 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bot className="size-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-none shadow-sm"
                          : "bg-muted text-foreground rounded-bl-none border"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Fallback Manual Text Input */}
          <div className="flex gap-2">
            <Textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Ovoz o'rniga yozma ravishda javob berishingiz ham mumkin..."
              rows={2}
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage(manualInput)
                }
              }}
            />
            <Button
              type="button"
              className="h-full px-5 self-end"
              disabled={!manualInput.trim() || aiState === "processing"}
              onClick={() => handleSendMessage(manualInput)}
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB 2: Standard Voice/Text Submission ───────────────────────── */}
      {activeTab === "standard" && (
        <div>
          {/* Voice-first: big record button */}
          <Card className="mb-5">
            <CardContent className="flex flex-col items-center gap-4 py-8">
              {isRecording ? (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    className="size-28 flex-col gap-2 rounded-full text-base shadow-lg"
                    onClick={stopRecording}
                  >
                    <Square className="size-9 fill-current animate-pulse" />
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
                    className="size-28 flex-col gap-2 rounded-full text-base shadow-lg"
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

          {/* Photo upload */}
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
                      setPhotoFiles((files) =>
                        files.filter((_, i) => i !== index),
                      )
                    }
                    aria-label={t("audio_record_delete")}
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Send Button */}
          <LoadingButton
            type="button"
            size="lg"
            loading={submitting}
            disabled={!hasContent}
            onClick={submitStandard}
            className="h-16 w-full text-lg font-semibold shadow-lg"
          >
            {t("appeal_submit_send")}
          </LoadingButton>
        </div>
      )}
    </div>
  )
}
