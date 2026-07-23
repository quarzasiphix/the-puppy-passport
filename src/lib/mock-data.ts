import puppy1 from "@/assets/puppy-1.jpg";
import puppy2 from "@/assets/puppy-2.jpg";
import puppy3 from "@/assets/puppy-3.jpg";
import puppy4 from "@/assets/puppy-4.jpg";
import puppy5 from "@/assets/puppy-5.jpg";
import puppy6 from "@/assets/puppy-6.jpg";
import kennel1 from "@/assets/kennel-1.jpg";
import kennel2 from "@/assets/kennel-2.jpg";
import litter1 from "@/assets/litter-1.jpg";
import parentMother from "@/assets/parent-mother.jpg";
import parentFather from "@/assets/parent-father.jpg";

export type PuppyStatus = "available" | "reserved" | "applications-open" | "sold" | "draft";

export type Puppy = {
  id: string;
  name: string;
  breed: string;
  sex: "Male" | "Female";
  color: string;
  ageWeeks: number;
  dob: string;
  readyDate: string;
  pricePLN: number;
  priceEUR: number;
  city: string;
  country: string;
  breederId: string;
  breederName: string;
  kennel: string;
  verified: boolean;
  transportAvailable: boolean;
  status: PuppyStatus;
  image: string;
  gallery: string[];
  litterId: string;
  about: string;
};

export type Litter = {
  id: string;
  code: string;
  breed: string;
  birthDate: string;
  readyDate: string;
  mother: string;
  father: string;
  breederId: string;
  breederName: string;
  breederSlug?: string;
  kennel: string;
  puppyCount: number;
  available: number;
  reserved: number;
  waitingList: number;
  status: "planned" | "born" | "ready";
  image: string;
  registration: string;
};

export type Breeder = {
  id: string;
  name: string;
  kennel: string;
  slug: string;
  breeds: string[];
  region: string;
  city: string;
  country: string;
  years: number;
  rating: number;
  reviewCount: number;
  verified: boolean;
  association: string;
  availablePuppies: number;
  description: string;
  cover: string;
  logo: string;
  handovers: number;
  responseTime: string;
};

export const breeders: Breeder[] = [
  {
    id: "b1",
    name: "Anna Kowalska",
    kennel: "Cichy Las Kennel",
    slug: "cichy-las",
    breeds: ["Golden Retriever", "Labrador Retriever"],
    region: "Mazowieckie",
    city: "Warsaw",
    country: "Poland",
    years: 14,
    rating: 4.9,
    reviewCount: 87,
    verified: true,
    association: "Związek Kynologiczny w Polsce (ZKwP / FCI)",
    availablePuppies: 4,
    handovers: 62,
    responseTime: "under 4 hours",
    cover: kennel1,
    logo: puppy1,
    description:
      "Small family kennel raising golden and labrador retrievers with a focus on stable temperament and health-tested parents. Puppies grow up inside our home and finish early socialisation before going home.",
  },
  {
    id: "b2",
    name: "Tomasz Nowak",
    kennel: "Wolna Dolina",
    slug: "wolna-dolina",
    breeds: ["Border Collie", "Australian Shepherd"],
    region: "Małopolskie",
    city: "Kraków",
    country: "Poland",
    years: 9,
    rating: 4.8,
    reviewCount: 54,
    verified: true,
    association: "ZKwP / FCI, member of Polish Border Collie Club",
    availablePuppies: 2,
    handovers: 41,
    responseTime: "same day",
    cover: kennel2,
    logo: puppy2,
    description:
      "Working-line border collies bred for balanced drive and clear-headedness. All parents are hip, elbow and eye tested. Puppies are raised with early neurological stimulation.",
  },
  {
    id: "b3",
    name: "Katarzyna Wiśniewska",
    kennel: "Srebrna Rzeka",
    slug: "srebrna-rzeka",
    breeds: ["Bernese Mountain Dog"],
    region: "Dolnośląskie",
    city: "Wrocław",
    country: "Poland",
    years: 18,
    rating: 5.0,
    reviewCount: 112,
    verified: true,
    association: "ZKwP / FCI, Polish Bernese Mountain Dog Club",
    availablePuppies: 3,
    handovers: 94,
    responseTime: "under 8 hours",
    cover: kennel1,
    logo: puppy6,
    description:
      "Nearly two decades of dedicated bernese breeding. Longevity, calm temperament and thorough health testing are our priority. Small number of planned litters each year.",
  },
  {
    id: "b4",
    name: "Marek Zieliński",
    kennel: "Dolne Pola",
    slug: "dolne-pola",
    breeds: ["German Shepherd"],
    region: "Wielkopolskie",
    city: "Poznań",
    country: "Poland",
    years: 22,
    rating: 4.7,
    reviewCount: 143,
    verified: true,
    association: "ZKwP / FCI, working line SV",
    availablePuppies: 5,
    handovers: 156,
    responseTime: "under 12 hours",
    cover: kennel2,
    logo: puppy4,
    description:
      "Working line German shepherds with strong nerves, stable in family environments and capable in sport. Puppies leave with a full health book and lifetime breeder support.",
  },
];

export const puppies: Puppy[] = [
  {
    id: "p1",
    name: "Maja",
    breed: "Golden Retriever",
    sex: "Female",
    color: "Light cream",
    ageWeeks: 8,
    dob: "2026-05-16",
    readyDate: "2026-07-25",
    pricePLN: 6500,
    priceEUR: 1500,
    city: "Warsaw",
    country: "Poland",
    breederId: "b1",
    breederName: "Anna Kowalska",
    kennel: "Cichy Las Kennel",
    verified: true,
    transportAvailable: true,
    status: "available",
    image: puppy1,
    gallery: [puppy1, puppy3, puppy6, litter1],
    litterId: "l1",
    about:
      "Maja is a warm, curious puppy who is confident with new people and gentle with children. She has explored the garden, met visitors, and is already responding to her name. She will suit an active family who enjoys long walks and calm evenings at home.",
  },
  {
    id: "p2",
    name: "Rico",
    breed: "Border Collie",
    sex: "Male",
    color: "Tricolour",
    ageWeeks: 9,
    dob: "2026-05-10",
    readyDate: "2026-07-19",
    pricePLN: 7200,
    priceEUR: 1650,
    city: "Kraków",
    country: "Poland",
    breederId: "b2",
    breederName: "Tomasz Nowak",
    kennel: "Wolna Dolina",
    verified: true,
    transportAvailable: true,
    status: "applications-open",
    image: puppy2,
    gallery: [puppy2, puppy4, puppy1],
    litterId: "l2",
    about:
      "Rico is the most thoughtful puppy in his litter, always assessing before acting. Ideal for sport homes doing agility, obedience or herding. Needs a person who enjoys structured work.",
  },
  {
    id: "p3",
    name: "Coco",
    breed: "Labrador Retriever",
    sex: "Female",
    color: "Chocolate",
    ageWeeks: 7,
    dob: "2026-05-25",
    readyDate: "2026-08-05",
    pricePLN: 5800,
    priceEUR: 1350,
    city: "Warsaw",
    country: "Poland",
    breederId: "b1",
    breederName: "Anna Kowalska",
    kennel: "Cichy Las Kennel",
    verified: true,
    transportAvailable: true,
    status: "reserved",
    image: puppy3,
    gallery: [puppy3, puppy1],
    litterId: "l1",
    about: "Coco is easy-going and food motivated — a classic labrador in the making.",
  },
  {
    id: "p4",
    name: "Bruno",
    breed: "German Shepherd",
    sex: "Male",
    color: "Black and tan",
    ageWeeks: 8,
    dob: "2026-05-18",
    readyDate: "2026-07-27",
    pricePLN: 8500,
    priceEUR: 1950,
    city: "Poznań",
    country: "Poland",
    breederId: "b4",
    breederName: "Marek Zieliński",
    kennel: "Dolne Pola",
    verified: true,
    transportAvailable: true,
    status: "available",
    image: puppy4,
    gallery: [puppy4, puppy2],
    litterId: "l4",
    about:
      "Bruno is a stable, self-assured male with strong hunt drive. Recommended for experienced owners or working homes.",
  },
  {
    id: "p5",
    name: "Nala",
    breed: "French Bulldog",
    sex: "Female",
    color: "Fawn",
    ageWeeks: 10,
    dob: "2026-05-01",
    readyDate: "2026-07-10",
    pricePLN: 9800,
    priceEUR: 2250,
    city: "Gdańsk",
    country: "Poland",
    breederId: "b3",
    breederName: "Katarzyna Wiśniewska",
    kennel: "Srebrna Rzeka",
    verified: true,
    transportAvailable: true,
    status: "applications-open",
    image: puppy5,
    gallery: [puppy5, puppy6],
    litterId: "l3",
    about: "Nala is playful, social and affectionate. Fully checked by our vet.",
  },
  {
    id: "p6",
    name: "Bella",
    breed: "Bernese Mountain Dog",
    sex: "Female",
    color: "Tricolour",
    ageWeeks: 9,
    dob: "2026-05-08",
    readyDate: "2026-07-17",
    pricePLN: 11500,
    priceEUR: 2650,
    city: "Wrocław",
    country: "Poland",
    breederId: "b3",
    breederName: "Katarzyna Wiśniewska",
    kennel: "Srebrna Rzeka",
    verified: true,
    transportAvailable: true,
    status: "available",
    image: puppy6,
    gallery: [puppy6, puppy3],
    litterId: "l3",
    about: "Bella is a calm, thoughtful puppy — a true bernese in miniature.",
  },
];

export const litters: Litter[] = [
  {
    id: "l1",
    code: "Litter M — Cichy Las",
    breed: "Golden Retriever",
    birthDate: "2026-05-16",
    readyDate: "2026-07-25",
    mother: "Cichy Las Amber",
    father: "Sunfield Orion",
    breederId: "b1",
    breederName: "Anna Kowalska",
    kennel: "Cichy Las Kennel",
    puppyCount: 8,
    available: 3,
    reserved: 4,
    waitingList: 2,
    status: "born",
    image: litter1,
    registration: "ZKwP / FCI",
  },
  {
    id: "l2",
    code: "Litter R — Wolna Dolina",
    breed: "Border Collie",
    birthDate: "2026-05-10",
    readyDate: "2026-07-19",
    mother: "Wolna Dolina Iskra",
    father: "Northwind Storm",
    breederId: "b2",
    breederName: "Tomasz Nowak",
    kennel: "Wolna Dolina",
    puppyCount: 6,
    available: 2,
    reserved: 3,
    waitingList: 4,
    status: "born",
    image: litter1,
    registration: "ZKwP / FCI",
  },
  {
    id: "l3",
    code: "Litter B — Srebrna Rzeka",
    breed: "Bernese Mountain Dog",
    birthDate: "2026-05-08",
    readyDate: "2026-07-17",
    mother: "Srebrna Rzeka Halia",
    father: "Alpen Bard",
    breederId: "b3",
    breederName: "Katarzyna Wiśniewska",
    kennel: "Srebrna Rzeka",
    puppyCount: 7,
    available: 3,
    reserved: 2,
    waitingList: 5,
    status: "born",
    image: litter1,
    registration: "ZKwP / FCI",
  },
  {
    id: "l4",
    code: "Litter K — Dolne Pola",
    breed: "German Shepherd",
    birthDate: "2026-05-18",
    readyDate: "2026-07-27",
    mother: "Dolne Pola Vela",
    father: "Erlenhof Kado",
    breederId: "b4",
    breederName: "Marek Zieliński",
    kennel: "Dolne Pola",
    puppyCount: 9,
    available: 5,
    reserved: 3,
    waitingList: 1,
    status: "born",
    image: litter1,
    registration: "ZKwP / FCI, SV",
  },
];

export const plannedLitters: Litter[] = [
  {
    id: "pl1",
    code: "Planned Litter N — Cichy Las",
    breed: "Labrador Retriever",
    birthDate: "2026-09-12",
    readyDate: "2026-11-21",
    mother: "Cichy Las Nutmeg",
    father: "Copperfield Vega",
    breederId: "b1",
    breederName: "Anna Kowalska",
    kennel: "Cichy Las Kennel",
    puppyCount: 7,
    available: 7,
    reserved: 0,
    waitingList: 3,
    status: "planned",
    image: parentMother,
    registration: "ZKwP / FCI",
  },
  {
    id: "pl2",
    code: "Planned Litter S — Wolna Dolina",
    breed: "Border Collie",
    birthDate: "2026-10-04",
    readyDate: "2026-12-13",
    mother: "Wolna Dolina Sara",
    father: "Highfield Rune",
    breederId: "b2",
    breederName: "Tomasz Nowak",
    kennel: "Wolna Dolina",
    puppyCount: 6,
    available: 6,
    reserved: 0,
    waitingList: 6,
    status: "planned",
    image: parentFather,
    registration: "ZKwP / FCI",
  },
  {
    id: "pl3",
    code: "Planned Litter D — Srebrna Rzeka",
    breed: "Bernese Mountain Dog",
    birthDate: "2026-11-02",
    readyDate: "2027-01-11",
    mother: "Srebrna Rzeka Duna",
    father: "Alpen Rex",
    breederId: "b3",
    breederName: "Katarzyna Wiśniewska",
    kennel: "Srebrna Rzeka",
    puppyCount: 7,
    available: 7,
    reserved: 0,
    waitingList: 12,
    status: "planned",
    image: parentMother,
    registration: "ZKwP / FCI",
  },
];

export const parents = {
  mother: {
    name: "Wolna Dolina Iskra",
    pedigree: "PKR.I-88214",
    image: parentMother,
    tests: ["HD-A / ED-0", "Eyes clear (2025)", "CEA / TNS / DNA clear"],
    titles: "PL CH, Working test I° pass",
    description:
      "Iskra is a five-year-old female with a soft, cooperative temperament and a strong work ethic. Lives at home, spends her days on the farm.",
  },
  father: {
    name: "Northwind Storm",
    pedigree: "UK KC AZ01234501",
    image: parentFather,
    tests: ["HD-A / ED-0", "Eyes clear (2025)", "CEA / TNS / DNA clear", "MDR1 +/+"],
    titles: "INT CH, Agility Grade 6",
    description:
      "Storm is an internationally titled working border collie known for balanced drive and stable nerves in high-pressure environments.",
  },
};

export const applications = [
  {
    id: "a1",
    buyer: "Julia Kowalczyk",
    city: "Warsaw",
    country: "Poland",
    household: "House with garden, 2 adults, no children",
    experience: "10 years with a golden retriever",
    purpose: "Family companion",
    transport: "Collect from breeder",
    date: "2026-07-02",
    status: "new" as const,
    puppy: "Maja",
    puppyId: "p1",
  },
  {
    id: "a2",
    buyer: "Michał Adamski",
    city: "Berlin",
    country: "Germany",
    household: "Apartment with balcony, 1 adult, home office",
    experience: "First-time owner, breed-focused research",
    purpose: "Family companion",
    transport: "International transport",
    date: "2026-07-01",
    status: "in-review" as const,
    puppy: "Rico",
    puppyId: "p2",
  },
  {
    id: "a3",
    buyer: "Ewa Malinowska",
    city: "Gdańsk",
    country: "Poland",
    household: "House with garden, 2 adults, 2 children (10, 12)",
    experience: "Previously two labradors",
    purpose: "Family companion",
    transport: "Domestic transport",
    date: "2026-06-30",
    status: "approved" as const,
    puppy: "Bruno",
    puppyId: "p4",
  },
  {
    id: "a4",
    buyer: "Lars Andersen",
    city: "Copenhagen",
    country: "Denmark",
    household: "House with garden, 2 adults",
    experience: "Sport homes — agility for 8 years",
    purpose: "Sport",
    transport: "International transport",
    date: "2026-06-28",
    status: "waiting-list" as const,
    puppy: "Rico",
    puppyId: "p2",
  },
];

export const reservations = [
  {
    id: "r1",
    puppy: "Coco",
    puppyId: "p3",
    buyer: "Piotr Lewandowski",
    reservationDate: "2026-06-20",
    deposit: "paid",
    agreement: "signed",
    documents: "5 / 7 complete",
    collectionDate: "2026-08-05",
    status: "on track",
  },
  {
    id: "r2",
    puppy: "Bella",
    puppyId: "p6",
    buyer: "Marie Dubois",
    reservationDate: "2026-06-15",
    deposit: "pending",
    agreement: "sent",
    documents: "3 / 7 complete",
    collectionDate: "2026-07-17",
    status: "waiting on deposit",
  },
];

export const transportRequests = [
  {
    id: "t1",
    puppy: "Bruno",
    from: "Poznań, Poland",
    to: "Munich, Germany",
    requestedDate: "2026-07-28",
    type: "Shared",
    priceEUR: 320,
    documents: "complete",
    status: "Scheduled",
    step: 4,
  },
  {
    id: "t2",
    puppy: "Rico",
    from: "Kraków, Poland",
    to: "Berlin, Germany",
    requestedDate: "2026-07-20",
    type: "Individual",
    priceEUR: 640,
    documents: "checking",
    status: "Documents checked",
    step: 2,
  },
  {
    id: "t3",
    puppy: "Nala",
    from: "Gdańsk, Poland",
    to: "Amsterdam, Netherlands",
    requestedDate: "2026-07-12",
    type: "Shared",
    priceEUR: 380,
    documents: "complete",
    status: "In transit",
    step: 6,
  },
];

export const transportSteps = [
  "Request submitted",
  "Documents checked",
  "Quote prepared",
  "Accepted",
  "Scheduled",
  "Collected",
  "In transit",
  "Delivered",
];

export const savedPuppies = ["p1", "p6"];

export const buyerApplications = [
  {
    id: "ba1",
    puppyName: "Maja",
    puppyId: "p1",
    kennel: "Cichy Las Kennel",
    date: "2026-07-02",
    status: "In review" as const,
    note: "Breeder is reviewing your application.",
  },
  {
    id: "ba2",
    puppyName: "Bella",
    puppyId: "p6",
    kennel: "Srebrna Rzeka",
    date: "2026-06-28",
    status: "Approved" as const,
    note: "Application approved — breeder is waiting for your reservation decision.",
  },
  {
    id: "ba3",
    puppyName: "Rico",
    puppyId: "p2",
    kennel: "Wolna Dolina",
    date: "2026-06-25",
    status: "Waiting list" as const,
    note: "Added to waiting list for the next planned litter.",
  },
];
