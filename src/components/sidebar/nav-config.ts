import type { LucideIcon } from "lucide-react";
import {
  Users,
  User,
  Building2,
  Landmark,
  List,
  Map,
  Building,
  FileText,
  File,
  LayoutDashboard,
  UserCog,
  Database,
  ArrowUpDown,
  Settings,
} from "lucide-react";

export type NavItem = {
  key: string;
  href?: string;  // undefined = coming soon (rendered disabled)
  icon: LucideIcon;
};

export type NavSection = {
  key: string;
  icon: LucideIcon;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    key: "people",
    icon: Users,
    items: [
      { key: "naturalPerson", href: "/natural-persons", icon: User },
      { key: "judicialPerson", icon: Building2 },
    ],
  },
  {
    key: "property",
    icon: Landmark,
    items: [
      { key: "landList", href: "/properties", icon: List },
      { key: "landMap", href: "/properties/map", icon: Map },
      { key: "building", icon: Building },
    ],
  },
  {
    key: "paperwork",
    icon: FileText,
    items: [
      { key: "allDocuments",             href: "/paperwork",                                      icon: FileText },
      { key: "actAdjudecare",            href: "/paperwork?type=ACT_ADJUDECARE",                  icon: File },
      { key: "actCadastru",              href: "/paperwork?type=ACT_CADASTRU",                    icon: File },
      { key: "actDonatie",               href: "/paperwork?type=ACT_DONATIE",                     icon: File },
      { key: "autorizatie",              href: "/paperwork?type=AUTORIZATIE",                     icon: File },
      { key: "avizInstitutie",           href: "/paperwork?type=AVIZ_INSTITUTIE",                 icon: File },
      { key: "certificatFiscal",         href: "/paperwork?type=CERTIFICAT_FISCAL",               icon: File },
      { key: "certificatMostenitor",     href: "/paperwork?type=CERTIFICAT_MOSTENITOR",           icon: File },
      { key: "certificatSarcini",        href: "/paperwork?type=CERTIFICAT_SARCINI",              icon: File },
      { key: "certificatUrbanism",       href: "/paperwork?type=CERTIFICAT_URBANISM",             icon: File },
      { key: "contractArenda",           href: "/paperwork?type=CONTRACT_ARENDA",                 icon: File },
      { key: "contractInchiriere",       href: "/paperwork?type=CONTRACT_INCHIRIERE",             icon: File },
      { key: "contractPartaj",           href: "/paperwork?type=CONTRACT_PARTAJ",                 icon: File },
      { key: "contractPrestariServicii", href: "/paperwork?type=CONTRACT_PRESTARI_SERVICII",      icon: File },
      { key: "contractVanzare",          href: "/paperwork?type=CONTRACT_VANZARE",                icon: File },
      { key: "extrasCarteFunciara",      href: "/paperwork?type=EXTRAS_CARTE_FUNCIARA",           icon: File },
      { key: "extrasPug",                href: "/paperwork?type=EXTRAS_PUG",                      icon: File },
      { key: "hotarareJudecatoreasca",   href: "/paperwork?type=HOTARARE_JUDECATOREASCA",         icon: File },
      { key: "testament",                href: "/paperwork?type=TESTAMENT",                       icon: File },
      { key: "titluProprietate",         href: "/paperwork?type=TITLU_PROPRIETATE",               icon: File },
    ],
  },
  {
    key: "administration",
    icon: LayoutDashboard,
    items: [
      { key: "users", icon: UserCog },
      { key: "referenceData", href: "/admin/value-lists", icon: Database },
      { key: "importExport", icon: ArrowUpDown },
      { key: "settings", icon: Settings },
    ],
  },
];
