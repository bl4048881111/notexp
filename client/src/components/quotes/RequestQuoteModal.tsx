import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface RequestQuoteModalProps {
  open: boolean;
  onClose: () => void;
}

export default function RequestQuoteModal({ open, onClose }: RequestQuoteModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    nome: "",
    cognome: "",
    telefono: "",
    targa: "",
    note: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Chiamata API per invio email
      const res = await fetch("/.netlify/functions/sendQuoteRequest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        toast({ title: "Richiesta inviata", description: "La tua richiesta è stata inviata con successo!" });
        setForm({ nome: "", cognome: "", telefono: "", targa: "", note: "" });
        onClose();
      } else {
        toast({ title: "Errore", description: "Errore durante l'invio della richiesta.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Errore", description: "Errore di rete.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Richiedi Preventivo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input name="nome" placeholder="Nome" value={form.nome} onChange={handleChange} required />
          <Input name="cognome" placeholder="Cognome" value={form.cognome} onChange={handleChange} required />
          <Input name="telefono" placeholder="Telefono" value={form.telefono} onChange={handleChange} required />
          <Input name="targa" placeholder="Targa" value={form.targa} onChange={handleChange} required />
          <Textarea name="note" placeholder="Note libere" value={form.note} onChange={handleChange} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Annulla</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Invio..." : "Invia richiesta"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 