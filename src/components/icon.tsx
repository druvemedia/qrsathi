import {
  Briefcase, Building2, CalendarDays, Camera, CirclePlay, Contact, FileText, Globe, IndianRupee, Landmark, LayoutTemplate, Link,
  Mail, MapPin, MessageCircle, MessageSquare, Package, Phone, QrCode, RefreshCw, Smartphone, Star, ThumbsUp, TicketPercent, Type,
  UtensilsCrossed, Wifi, type LucideProps,
} from "lucide-react";

const ICONS = {
  Briefcase, Building2, CalendarDays, Camera, CirclePlay, Contact, FileText, Globe, IndianRupee, Landmark, LayoutTemplate, Link,
  Mail, MapPin, MessageCircle, MessageSquare, Package, Phone, QrCode, RefreshCw, Smartphone, Star, ThumbsUp, TicketPercent, Type,
  UtensilsCrossed, Wifi,
};

export function TypeIcon({ name, ...props }: { name: string } & LucideProps) {
  const C = ICONS[name as keyof typeof ICONS] || QrCode;
  return <C {...props} />;
}
