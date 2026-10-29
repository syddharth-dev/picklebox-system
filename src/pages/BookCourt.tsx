import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Users, Clock, CreditCard, CheckCircle } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCourt } from "@/hooks/useCourts";
import { useBookedSlots } from "@/hooks/useBookings";
import court1Image from "@/assets/court-1.png";
import court2Image from "@/assets/court-2.png";
import court3Image from "@/assets/court-3.png";

const courtImages: Record<string, string> = {
  "/assets/court-1.png": court1Image,
  "/assets/court-2.png": court2Image,
  "/assets/court-3.png": court3Image,
};

const allTimeSlots = [
  "06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
  "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM",
];

const convertTo24h = (time12h: string): string => {
  const [time, modifier] = time12h.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;
};

const BookCourt = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: court, isLoading } = useCourt(id);
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined;
  const { data: bookedSlots } = useBookedSlots(id, dateStr);

  // Build time slots with availability
  const bookedStartTimes = new Set(bookedSlots?.map((b) => b.start_time) || []);
  const timeSlots = allTimeSlots.map((time) => ({
    time,
    available: !bookedStartTimes.has(convertTo24h(time)),
  }));

  const toggleSlot = (time: string) => {
    setSelectedSlots((prev) =>
      prev.includes(time)
        ? prev.filter((t) => t !== time)
        : [...prev, time]
    );
  };

  const totalPrice = selectedSlots.length * (court?.price_per_hour || 0);

  const handleProceedToPayment = () => {
    if (!selectedDate || selectedSlots.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select a date and at least one time slot.",
        variant: "destructive",
      });
      return;
    }

    navigate("/checkout", {
      state: {
        court,
        date: selectedDate,
        slots: selectedSlots,
        totalPrice,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-32 pb-16 md:pt-36">
          <div className="container mx-auto px-4">
            <Skeleton className="h-8 w-32 mb-6" />
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Skeleton className="h-80 w-full rounded-2xl" />
                <Skeleton className="h-96 w-full rounded-2xl" />
              </div>
              <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!court) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-32 pb-16 md:pt-36">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Court not found</h1>
            <Link to="/courts">
              <Button>Back to Courts</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const courtImage = courtImages[court.image_url || ""] || court.image_url || court1Image;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-32 pb-16 md:pt-36">
        <div className="container mx-auto px-4">
          <Link to="/courts" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Courts</span>
          </Link>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl overflow-hidden border border-border bg-card">
                <div className="relative h-64 md:h-80">
                  <img
                    src={courtImage}
                    alt={court.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-6">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                    {court.name}
                  </h1>
                  {court.description && (
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      {court.description}
                    </p>
                  )}
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Select Date & Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm font-medium text-foreground mb-3">Choose a Date</p>
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => date < new Date() || date > addDays(new Date(), 30)}
                        className="rounded-lg border"
                      />
                    </div>

                    <div>
                      <p className="text-sm font-medium text-foreground mb-3">
                        Available Time Slots
                        {selectedDate && (
                          <span className="text-muted-foreground font-normal ml-2">
                            ({format(selectedDate, "MMM d, yyyy")})
                          </span>
                        )}
                      </p>
                      <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-2">
                        {timeSlots.map((slot) => (
                          <button
                            key={slot.time}
                            onClick={() => slot.available && toggleSlot(slot.time)}
                            disabled={!slot.available}
                            className={cn(
                              "p-3 rounded-lg text-sm font-medium transition-all duration-200",
                              slot.available
                                ? selectedSlots.includes(slot.time)
                                  ? "gradient-primary text-primary-foreground shadow-md"
                                  : "bg-muted hover:bg-muted/80 text-foreground"
                                : "bg-muted/50 text-muted-foreground cursor-not-allowed line-through"
                            )}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Booking Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg gradient-primary">
                      <Users className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{court.name}</p>
                      <p className="text-sm text-muted-foreground">Up to 4 players</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium text-foreground">
                        {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Not selected"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Time Slots</span>
                      <span className="font-medium text-foreground">
                        {selectedSlots.length > 0 ? `${selectedSlots.length} hour(s)` : "None selected"}
                      </span>
                    </div>
                    {selectedSlots.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedSlots.map((slot) => (
                          <Badge key={slot} variant="secondary" className="text-xs">
                            {slot}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rate per Hour</span>
                      <span className="font-medium text-foreground">₱{court.price_per_hour}</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-foreground">Total</span>
                    <span className="text-2xl font-bold text-primary">₱{totalPrice}</span>
                  </div>

                  <Button 
                    variant="hero" 
                    size="lg" 
                    className="w-full"
                    onClick={handleProceedToPayment}
                    disabled={selectedSlots.length === 0}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Proceed to Payment
                  </Button>

                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Instant confirmation</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default BookCourt;
