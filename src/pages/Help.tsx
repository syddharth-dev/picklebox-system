import { ArrowRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PageHeading } from "@/components/layout/PageHeading";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import communityImage from "@/assets/venue/community.jpg";

const topics = [
  { title: "Courts & reservations", questions: [
    ["How do I book a court?", "Open Courts, choose a date, and select the available hours you want. You can select more than one hour or court. Continue to checkout to review your reservation and submit your GCash reference."],
    ["What does a pending reservation mean?", "Your selected hours are reserved while staff verify the GCash payment reference you submitted. Payment approval changes the booking to Paid and unlocks its check-in QR."],
    ["Can I cancel a court booking?", "You can cancel a pending reservation from My bookings. For a paid booking or a refund request, contact the venue. Paid reservations cannot be cancelled automatically from your account."],
  ] },
  { title: "Open Play", questions: [
    ["Do I need to bring a group?", "No. Open Play is registered per player. Choose a session for your skill level and check its fee, date, courts, and remaining spots before registering."],
    ["What happens when a session is full?", "You can join the waitlist. Before the session starts, the next eligible player moves into a registered spot when one becomes available. Waitlisted players do not receive an active check-in pass."],
    ["How do Open Play cancellations work?", "Each session shows its cancellation cutoff. You can cancel an eligible registration before that deadline. After the deadline, or once you are checked in, contact the venue for changes."],
  ] },
  { title: "Payments & arrival", questions: [
    ["How do I pay with GCash?", "Use the venue GCash QR displayed during checkout or in the Open Play session. Send the amount shown and enter your payment reference. Staff verify payments; entering a reference alone does not approve a payment."],
    ["Where is my check-in QR?", "For court bookings, open My bookings after payment approval and select Show check-in QR. For Open Play, reopen your registered session. Your pass becomes available once you are registered and payment is approved."],
    ["Where is The Pickle Box?", "Find us on Endrina Street in San Carlos City, Negros Occidental. Use the directions link below to open a map search for the venue."],
  ] },
];

export default function Help() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main id="main-content" className="pb-20 pt-32 md:pt-40">
        <div className="site-container">
          <PageHeading title="A little help, before you play." description="Straight answers on reservations, Open Play, GCash, and getting on court."
            image={communityImage} imageAlt="Players at The Pickle Box" />
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_320px] lg:gap-20">
            <div className="space-y-12">
              {topics.map((topic) => (
                <section key={topic.title}>
                  <h2 className="mb-4 text-xl font-bold">{topic.title}</h2>
                  <Accordion type="single" collapsible>
                    {topic.questions.map(([question, answer]) => (
                      <AccordionItem key={question} value={question}>
                        <AccordionTrigger className="py-5 text-left text-sm font-semibold hover:no-underline">{question}</AccordionTrigger>
                        <AccordionContent className="max-w-2xl text-sm leading-7 text-muted-foreground">{answer}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              ))}
            </div>
            <aside className="rounded-xl bg-brand-lime p-7 text-brand-ink lg:sticky lg:top-32">
              <h2 className="font-display text-4xl leading-none">See you at<br />The Pickle Box.</h2>
              <p className="mb-6 mt-4 flex gap-2 text-sm leading-6"><MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />Endrina St., San Carlos City,<br />Negros Occidental</p>
              <a href="https://www.google.com/maps/search/?api=1&query=The+Pickle+Box+Endrina+Street+San+Carlos+City+Negros+Occidental" target="_blank" rel="noreferrer" className="text-link">Open directions <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
              <div className="mt-6 border-t border-brand-ink/20 pt-5"><Link to="/courts" className="text-link">Ready to book? <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
