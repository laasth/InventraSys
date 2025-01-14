export default {
  header: {
    title: 'Administrer Lager',
    listTitle: 'Lagerliste',
    search: 'Søk etter delenummer eller navn...',
    backToList: 'Tilbake til Liste',
    manageInventory: 'Administrer Lager',
    backToInventory: 'Tilbake til Lager'
  },
  pagination: {
    showing: 'Viser',
    of: 'av',
    items: 'varer'
  },
  columns: {
    location: 'Plassering',
    partNumber: 'Delenummer',
    name: 'Navn',
    description: 'Beskrivelse',
    purchasePrice: 'Innkjøpspris',
    salePrice: 'Utsalgspris',
    quantity: 'Antall',
    lastModified: 'Sist Endret',
    lastStockCount: 'Sist Opptalt',
    actions: 'Handlinger'
  },
  actions: {
    add: 'Legg til',
    edit: 'Rediger',
    delete: 'Slett',
    save: 'Lagre',
    cancel: 'Avbryt',
    stockCount: 'Varetelling'
  },
  stockCount: {
    title: 'Varetelling',
    enterQuantity: 'Angi Antall',
    quantityPlaceholder: 'Angi nåværende antall',
    confirmCurrent: 'Bekreft Nåværende',
    update: 'Oppdater',
    updated: 'Varetelling oppdatert',
    completed: 'Varetelling fullført',
    error: 'Feil ved oppdatering av varetelling',
    invalidQuantity: 'Vennligst angi et gyldig antall',
    noItems: 'Ingen varer å telle',
    items: 'varer',
    lastCounted: 'Sist opptalt',
    delete: 'Slett',
    confirmDelete: 'Er du sikker på at du vil slette {name}?',
    deleted: 'Varen ble slettet',
    filterAll: 'Vis alle varer',
    filter7Days: 'Ikke opptalt siste 7 dager',
    filter30Days: 'Ikke opptalt siste 30 dager'
  },
  confirmations: {
    deleteItem: 'Er du sikker på at du vil slette denne varen?'
  },
  dialog: {
    removeFromInventory: 'Fjern fra lager',
    removeUnits: 'Hvor mange enheter vil du fjerne fra {name}?',
    cancel: 'Avbryt',
    confirm: 'Bekreft',
    addItem: 'Legg til ny vare',
    welcome: 'Velkommen til InventraSys',
    enterUsername: 'Vennligst skriv inn ditt brukernavn for å fortsette',
    usernamePlaceholder: 'Skriv inn brukernavn',
    submit: 'Send inn',
    logout: 'Logg ut'
  },
  time: {
    justNow: 'Akkurat nå',
    minutesAgo: '{minutes} minutter siden',
    hoursAgo: '{hours} timer siden',
    daysAgo: '{days} dager siden'
  },
  auditLog: {
    title: 'Endringslogg',
    action: 'Handling',
    username: 'Brukernavn',
    timestamp: 'Tidspunkt',
    itemName: 'Varenavn',
    partNumber: 'Delenummer',
    oldValue: 'Gammel Verdi',
    newValue: 'Ny Verdi',
    noLogs: 'Ingen endringer funnet',
    viewAuditLog: 'Vis Endringslogg',
    description: 'Denne loggen viser alle endringer gjort i lageret, inkludert hvem som gjorde endringene og når.',
    viewDetails: 'Vis Detaljer',
    closeDetails: 'Lukk',
    valueDetails: 'Endringsdetaljer'
  }
};
