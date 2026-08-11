"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type RejectDialogProps = {
  trigger: React.ReactNode;
  title: string;
  description: string;
  busy?: boolean;
  onConfirm: (comment: string) => Promise<void>;
};

export function RejectDialog({ trigger, title, description, busy, onConfirm }: RejectDialogProps) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) {
      setError("Un motif est requis");
      return;
    }
    setError("");
    try {
      await onConfirm(comment.trim());
      setOpen(false);
      setComment("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <label className="text-sm font-medium">Motif du rejet</label>
            <Textarea
              rows={3}
              placeholder="Raison du refus..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              Rejeter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
