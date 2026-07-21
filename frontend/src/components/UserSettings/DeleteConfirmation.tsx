import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { UsersService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { LoadingButton } from "@/components/ui/loading-button"
import useAuth from "@/hooks/useAuth"

const DeleteConfirmation = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { logout } = useAuth()

  const mutation = useMutation({
    mutationFn: () => UsersService.deleteUserMe(),
    onSuccess: () => {
      toast.success(t("settings_delete_success"))
      logout()
    },
    onError: (err: Error) => {
      toast.error(err.message || t("error_generic"))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
    },
  })

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">{t("settings_delete_account")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settings_delete_account")}</DialogTitle>
        </DialogHeader>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline" disabled={mutation.isPending}>
              {t("settings_delete_cancel")}
            </Button>
          </DialogClose>
          <LoadingButton
            variant="destructive"
            type="button"
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t("settings_delete_confirm")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteConfirmation
