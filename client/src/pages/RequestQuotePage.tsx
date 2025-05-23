import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function RequestQuotePage() {
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
      const res = await fetch("/.netlify/functions/sendQuoteRequest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        toast({ title: "Richiesta inviata", description: "La tua richiesta è stata inviata con successo!" });
        setForm({ nome: "", cognome: "", telefono: "", targa: "", note: "" });
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-950 to-black text-white">
      <div className="bg-black/80 rounded-lg shadow-lg p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-orange-500 text-center">Richiedi Preventivo</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input name="nome" placeholder="Nome" value={form.nome} onChange={handleChange} required />
          <Input name="cognome" placeholder="Cognome" value={form.cognome} onChange={handleChange} required />
          <Input name="telefono" placeholder="Telefono" value={form.telefono} onChange={handleChange} required />
          <Input name="targa" placeholder="Targa" value={form.targa} onChange={handleChange} required />
          <Textarea name="note" placeholder="Note libere" value={form.note} onChange={handleChange} />
          <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>{isSubmitting ? "Invio..." : "Invia richiesta"}</Button>
        </form>
      </div>
    </div>
  );
} 