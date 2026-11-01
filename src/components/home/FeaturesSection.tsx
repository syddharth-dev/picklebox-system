import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const questions = [
  { question: "Can I come without a group?", answer: "Yes. Open Play lets you register as an individual. Check each session for its skill level, fee, and remaining spots." },
  { question: "How do I pay for a reservation?", answer: "Choose your hours, pay using the venue's GCash QR, and enter your payment reference. Your reservation stays pending until staff approve your payment." },
  { question: "Where will I find my check-in pass?", answer: "Open My bookings after your payment is approved. Your reservation will have a Show check-in QR button. Open Play passes are available in your registered session." },
];

export function FeaturesSection() {
  return (
    <section id="questions" className="site-container site-section border-t border-border">
      <div className="grid gap-8 md:grid-cols-[.8fr_1.2fr] md:gap-20">
        <div>
          <h2 className="section-title">Before<br />you play.</h2>
          <Link to="/help" className="text-link mt-5">More questions? <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {questions.map(({ question, answer }, index) => (
            <AccordionItem key={question} value={String(index)}>
              <AccordionTrigger className="py-6 text-left text-base font-semibold hover:no-underline">{question}</AccordionTrigger>
              <AccordionContent className="max-w-xl pb-6 text-sm leading-7 text-muted-foreground">{answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
