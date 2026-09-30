// Spec 24 — Dictionnaire de traductions : fr, wo (wolof), en
// IMPORTANT spec 24.3 : les traductions en wolof doivent être relues par des locuteurs
// compétents avant la mise en production. Les entrées marquées [wo-review] sont provisoires.

export type TranslationDict = {
  common: {
    save: string; cancel: string; back: string; next: string; close: string
    confirm: string; delete: string; edit: string; view: string; search: string
    filter: string; loading: string; error: string; success: string; yes: string; no: string
    required: string; optional: string; or: string; and: string; all: string
    from: string; to: string; at: string; by: string; for: string; in: string
    total: string; none: string; unknown: string; new: string
    send: string; submit: string; upload: string; download: string; print: string
    add: string; remove: string; update: string; create: string; refresh: string
    select: string; deselect: string; expand: string; collapse: string
    previous: string; next_page: string; page: string; of: string
    approved: string; refused: string; pending: string
  }
  nav: {
    dashboard: string; appointments: string; patients: string
    prescriptions: string; documents: string; history: string
    settings: string; logout: string; profile: string; notifications: string
    reservations: string; stock: string; payments: string; coverage: string
    members: string; requests: string; analytics: string; support: string
    validation: string; disputes: string; subscriptions: string; audit: string
    admins: string; features: string; parameters: string
  }
  actor: {
    patient: string; professional: string; pharmacy: string
    establishment: string; organisme: string; admin: string; super_admin: string
  }
  status: {
    // Réservations
    pending: string; confirmed: string; ready: string; collected: string
    cancelled: string; expired: string; failed: string
    // Couverture
    submitted: string; under_review: string; approved: string; partially_approved: string
    rejected: string; paid: string; partially_paid: string; contested: string
    // Abonnements (spec 23.6)
    trial: string; active: string; payment_pending: string
    suspended: string; cancelled_sub: string; expired_sub: string
    // Paiements
    initiated: string; processing: string; completed: string; refunded: string; disputed: string
    // Profils
    active_profile: string; inactive_profile: string; pending_verification: string
    info_required: string; refused_profile: string
    // Litiges
    new_dispute: string; in_progress: string; waiting: string; resolved: string; closed: string
  }
  form: {
    name: string; first_name: string; last_name: string; email: string; phone: string
    address: string; city: string; date: string; time: string; amount: string
    description: string; notes: string; reason: string; type: string
    password: string; confirm_password: string; birth_date: string
    gender: string; male: string; female: string
    specialty: string; license_number: string; rpps: string
    quantity: string; unit: string; dosage: string; duration: string
    start_date: string; end_date: string; expiry_date: string
    iban: string; siret: string; nif: string
  }
  error: {
    required_field: string; invalid_email: string; invalid_phone: string
    network_error: string; unauthorized: string; not_found: string
    server_error: string; session_expired: string; invalid_format: string
    too_short: string; too_long: string; passwords_mismatch: string
    already_exists: string; insufficient_permissions: string
  }
  appointment: {
    book: string; cancel: string; reschedule: string; confirm: string
    upcoming: string; past: string; today: string; no_slots: string
    reminder_sent: string; teleconsultation: string; in_person: string
  }
  prescription: {
    new: string; renew: string; valid_until: string; prescribed_by: string
    medications: string; instructions: string; send_to_pharmacy: string
  }
  notification: {
    appointment_reminder: string; reservation_ready: string
    payment_confirmed: string; coverage_decision: string
    profile_validated: string; new_message: string
    subscription_expiring: string
  }
  i18n: {
    language: string; change_language: string
    wolof_review_note: string   // spec 24.3
    data_not_translated: string  // spec 24.2 — données saisies non traduites
    doc_original_content: string // spec 24.2 — documents médicaux en VO
  }
  accessibility: {
    title: string; readable_text: string; large_buttons: string
    color_contrast: string; screen_reader: string; mobile_friendly: string
    skip_to_content: string; open_menu: string; close_menu: string
    image_alt: string; required_field: string; current_page: string
  }
}

const fr: TranslationDict = {
  common: {
    save: 'Enregistrer', cancel: 'Annuler', back: 'Retour', next: 'Suivant', close: 'Fermer',
    confirm: 'Confirmer', delete: 'Supprimer', edit: 'Modifier', view: 'Voir', search: 'Rechercher',
    filter: 'Filtrer', loading: 'Chargement…', error: 'Erreur', success: 'Succès', yes: 'Oui', no: 'Non',
    required: 'Obligatoire', optional: 'Optionnel', or: 'ou', and: 'et', all: 'Tous',
    from: 'De', to: 'À', at: 'À', by: 'Par', for: 'Pour', in: 'Dans',
    total: 'Total', none: 'Aucun', unknown: 'Inconnu', new: 'Nouveau',
    send: 'Envoyer', submit: 'Soumettre', upload: 'Importer', download: 'Télécharger', print: 'Imprimer',
    add: 'Ajouter', remove: 'Retirer', update: 'Mettre à jour', create: 'Créer', refresh: 'Actualiser',
    select: 'Sélectionner', deselect: 'Désélectionner', expand: 'Développer', collapse: 'Réduire',
    previous: 'Précédent', next_page: 'Suivant', page: 'Page', of: 'sur',
    approved: 'Approuvé', refused: 'Refusé', pending: 'En attente',
  },
  nav: {
    dashboard: 'Tableau de bord', appointments: 'Rendez-vous', patients: 'Patients',
    prescriptions: 'Ordonnances', documents: 'Documents', history: 'Historique',
    settings: 'Paramètres', logout: 'Déconnexion', profile: 'Profil', notifications: 'Notifications',
    reservations: 'Réservations', stock: 'Stock', payments: 'Paiements', coverage: 'Prise en charge',
    members: 'Adhérents', requests: 'Demandes', analytics: 'Statistiques', support: 'Support',
    validation: 'Validation', disputes: 'Litiges', subscriptions: 'Abonnements', audit: 'Audit',
    admins: 'Administrateurs', features: 'Fonctionnalités', parameters: 'Paramètres',
  },
  actor: {
    patient: 'Patient', professional: 'Professionnel de santé', pharmacy: 'Pharmacie',
    establishment: 'Établissement', organisme: 'Organisme de couverture',
    admin: 'Administrateur', super_admin: 'Super Administrateur',
  },
  status: {
    pending: 'En attente', confirmed: 'Confirmé', ready: 'Prêt', collected: 'Récupéré',
    cancelled: 'Annulé', expired: 'Expiré', failed: 'Échoué',
    submitted: 'Soumis', under_review: 'En cours d\'examen', approved: 'Approuvé',
    partially_approved: 'Partiellement approuvé', rejected: 'Rejeté', paid: 'Payé',
    partially_paid: 'Partiellement payé', contested: 'Contesté',
    trial: 'Essai', active: 'Actif', payment_pending: 'Paiement en attente',
    suspended: 'Suspendu', cancelled_sub: 'Résilié', expired_sub: 'Expiré',
    initiated: 'Initié', processing: 'En traitement', completed: 'Complété',
    refunded: 'Remboursé', disputed: 'Litigieux',
    active_profile: 'Actif', inactive_profile: 'Inactif', pending_verification: 'En attente de vérification',
    info_required: 'Informations requises', refused_profile: 'Refusé',
    new_dispute: 'Nouveau', in_progress: 'En cours', waiting: 'En attente', resolved: 'Résolu', closed: 'Clôturé',
  },
  form: {
    name: 'Nom', first_name: 'Prénom', last_name: 'Nom de famille', email: 'E-mail', phone: 'Téléphone',
    address: 'Adresse', city: 'Ville', date: 'Date', time: 'Heure', amount: 'Montant',
    description: 'Description', notes: 'Notes', reason: 'Motif', type: 'Type',
    password: 'Mot de passe', confirm_password: 'Confirmer le mot de passe', birth_date: 'Date de naissance',
    gender: 'Genre', male: 'Homme', female: 'Femme',
    specialty: 'Spécialité', license_number: "Numéro d'ordre", rpps: 'Numéro RPPS',
    quantity: 'Quantité', unit: 'Unité', dosage: 'Dosage', duration: 'Durée',
    start_date: 'Date de début', end_date: 'Date de fin', expiry_date: "Date d'expiration",
    iban: 'IBAN', siret: 'SIRET', nif: 'NIF',
  },
  error: {
    required_field: 'Ce champ est obligatoire', invalid_email: 'Adresse e-mail invalide',
    invalid_phone: 'Numéro de téléphone invalide', network_error: 'Erreur réseau, veuillez réessayer',
    unauthorized: 'Accès non autorisé', not_found: 'Ressource introuvable',
    server_error: 'Erreur serveur, veuillez réessayer plus tard', session_expired: 'Session expirée, reconnectez-vous',
    invalid_format: 'Format invalide', too_short: 'Trop court', too_long: 'Trop long',
    passwords_mismatch: 'Les mots de passe ne correspondent pas',
    already_exists: 'Existe déjà', insufficient_permissions: 'Permissions insuffisantes',
  },
  appointment: {
    book: 'Prendre rendez-vous', cancel: 'Annuler le rendez-vous', reschedule: 'Reporter',
    confirm: 'Confirmer le rendez-vous', upcoming: 'À venir', past: 'Passés', today: "Aujourd'hui",
    no_slots: 'Aucun créneau disponible', reminder_sent: 'Rappel envoyé',
    teleconsultation: 'Téléconsultation', in_person: 'En cabinet',
  },
  prescription: {
    new: 'Nouvelle ordonnance', renew: 'Renouveler', valid_until: "Valide jusqu'au",
    prescribed_by: 'Prescrit par', medications: 'Médicaments', instructions: 'Instructions',
    send_to_pharmacy: 'Envoyer à la pharmacie',
  },
  notification: {
    appointment_reminder: 'Rappel de rendez-vous', reservation_ready: 'Réservation prête à retirer',
    payment_confirmed: 'Paiement confirmé', coverage_decision: 'Décision de prise en charge',
    profile_validated: 'Profil validé', new_message: 'Nouveau message',
    subscription_expiring: 'Abonnement bientôt expiré',
  },
  i18n: {
    language: 'Langue', change_language: 'Changer de langue',
    wolof_review_note: 'Les traductions en wolof doivent être relues par des locuteurs compétents avant la mise en production.',
    data_not_translated: 'Les données saisies par les utilisateurs (noms, adresses…) ne sont pas traduites automatiquement.',
    doc_original_content: 'Les documents médicaux et décisions de couverture conservent leur contenu original. Toute traduction est clairement identifiée.',
  },
  accessibility: {
    title: 'Accessibilité', readable_text: 'Texte lisible', large_buttons: 'Boutons suffisamment grands',
    color_contrast: 'Contraste adapté', screen_reader: 'Compatible lecteurs d\'écran',
    mobile_friendly: 'Confortable sur petit écran', skip_to_content: 'Aller au contenu principal',
    open_menu: 'Ouvrir le menu', close_menu: 'Fermer le menu', image_alt: "Texte alternatif de l'image",
    required_field: 'Champ obligatoire', current_page: 'Page courante',
  },
}

// Wolof — [wo-review] : à valider par des locuteurs compétents avant production (spec 24.3)
const wo: TranslationDict = {
  common: {
    save: 'Dëkk', cancel: 'Yàqq', back: 'Dellu', next: 'Soog', close: 'Tëj',
    confirm: 'Sàmm', delete: 'Ñàkk', edit: 'Soppi', view: 'Xool', search: 'Seet',
    filter: 'Tànn', loading: 'Di jëlee…', error: 'Njuumte', success: 'Dëkk ak baax', yes: 'Waaw', no: 'Déedéet',
    required: 'Waajib', optional: 'Wàllu', or: 'walla', and: 'ak', all: 'Yépp',
    from: 'Ci', to: 'Ak', at: 'Ci', by: 'Bi', for: 'Bu', in: 'Ci',
    total: 'Yépp', none: 'Dara', unknown: 'Soxor', new: 'Bu bees',
    send: 'Yónnee', submit: 'Jox', upload: 'Jóg', download: 'Dàq', print: 'Imprime',
    add: 'Yokk', remove: 'Rëdd', update: 'Soppi', create: 'Defar', refresh: 'Regël',
    select: 'Tànn', deselect: 'Bàyyi', expand: 'Yees', collapse: 'Tëj',
    previous: 'Ginaaw', next_page: 'Soog', page: 'Laaj', of: 'ci',
    approved: 'Sàmm', refused: 'Dàq', pending: 'Di xaar',
  },
  nav: {
    dashboard: 'Tableau yi', appointments: 'Rendez-vous yi', patients: 'Claane yi',
    prescriptions: 'Ordonnance yi', documents: 'Dossier yi', history: 'Wàllu',
    settings: 'Soppi', logout: 'Génn', profile: 'Profil bam', notifications: 'Xam-xam yi',
    reservations: 'Réservation yi', stock: 'Xam médicament', payments: 'Loxo', coverage: 'Prise en charge',
    members: 'Membres yi', requests: 'Demande yi', analytics: 'Statistik', support: 'Tànk',
    validation: 'Valide', disputes: 'Litige yi', subscriptions: 'Abonnement yi', audit: 'Historique',
    admins: 'Administrateur yi', features: 'Fonctionnalité yi', parameters: 'Paramètre yi',
  },
  actor: {
    patient: 'Claane', professional: 'Doktoor / Tabib', pharmacy: 'Farmaasi',
    establishment: 'Dëkk ak doktoor', organisme: 'Organisme ci couverture',
    admin: 'Administrateur', super_admin: 'Super Administrateur',
  },
  status: {
    pending: 'Di xaar', confirmed: 'Sàmm', ready: 'Ëllëg', collected: 'Jot',
    cancelled: 'Yàqq', expired: 'Dugal waxtu', failed: 'Njuumte',
    submitted: 'Yónnee', under_review: 'Di xool', approved: 'Sàmm',
    partially_approved: 'Àttë ak yokk', rejected: 'Dàq', paid: 'Fay',
    partially_paid: 'Fay bokk', contested: 'Conteste',
    trial: 'Jëfandikoo', active: 'Dëkk', payment_pending: 'Di xaar fay',
    suspended: 'Tëj', cancelled_sub: 'Yàqq', expired_sub: 'Waxtu bi jeex',
    initiated: 'Tàkk', processing: 'Di dëkk', completed: 'Jeex',
    refunded: 'Dellu xaalis', disputed: 'Litige',
    active_profile: 'Dëkk', inactive_profile: 'Noppi', pending_verification: 'Di xaar valide',
    info_required: 'Xam-xam waajib', refused_profile: 'Dàq',
    new_dispute: 'Bu bees', in_progress: 'Di dëkk', waiting: 'Di xaar', resolved: 'Àndul', closed: 'Tëj',
  },
  form: {
    name: 'Tur', first_name: 'Tur bu jëkk', last_name: 'Tur bu xonk', email: 'Iimeel', phone: 'Telefon',
    address: 'Aadres', city: 'Dëkk', date: 'Bés', time: 'Waxtu', amount: 'Xaalis',
    description: 'Wax', notes: 'Xam-xam', reason: 'Xam-xam', type: 'Xeex',
    password: 'Mot de passe', confirm_password: 'Sàmm mot de passe', birth_date: 'Bés bi dan woon',
    gender: 'Góor walla jigéen', male: 'Góor', female: 'Jigéen',
    specialty: 'Spécialité', license_number: 'Numéro ordre', rpps: 'Numéro RPPS',
    quantity: 'Yëgël', unit: 'Unité', dosage: 'Dosage', duration: 'Waxtu',
    start_date: 'Bés bii doon tàkk', end_date: 'Bés bii doon jeex', expiry_date: 'Bés expiration',
    iban: 'IBAN', siret: 'SIRET', nif: 'NIF',
  },
  error: {
    required_field: 'Li la waajib dëkk ko', invalid_email: 'Iimeel bu baax du dëkk',
    invalid_phone: 'Telefon bi baax du dëkk', network_error: 'Njuumte réseau, jëfandikoo ci kanam',
    unauthorized: 'Yóbbu ci boppam du dëkk', not_found: 'Xam-xam bi amul',
    server_error: 'Njuumte serveur', session_expired: 'Session bi jeex, connecte ak bi kanam',
    invalid_format: 'Format du baax', too_short: 'Gudd trop', too_long: 'Gudd trop',
    passwords_mismatch: 'Mot de passe yi dox du',
    already_exists: 'Amul ci di dëkk', insufficient_permissions: 'Yóbbu yi defekul',
  },
  appointment: {
    book: 'Tàkk rendez-vous', cancel: 'Yàqq rendez-vous bi', reschedule: 'Soppi waxtu',
    confirm: 'Sàmm rendez-vous bi', upcoming: 'Bi ëllëg', past: 'Jiggéenu', today: 'Tey',
    no_slots: 'Créneau amul', reminder_sent: 'Rappel yónnee',
    teleconsultation: 'Téléconsultation', in_person: 'Ci kabinè',
  },
  prescription: {
    new: 'Ordonnance bu bees', renew: 'Wàllu ci', valid_until: 'Dëkk ak',
    prescribed_by: 'Doktoor bi', medications: 'Kaafu yaram yi', instructions: 'Jëfandikoo',
    send_to_pharmacy: 'Yónnee farmaasi bi',
  },
  notification: {
    appointment_reminder: 'Rendez-vous rappel', reservation_ready: 'Réservation bi ëllëg',
    payment_confirmed: 'Fay sàmm', coverage_decision: 'Décision prise en charge',
    profile_validated: 'Profil valide', new_message: 'Xam-xam bu bees',
    subscription_expiring: 'Abonnement bees di jeex',
  },
  i18n: {
    language: 'Làkk', change_language: 'Soppi làkk bi',
    wolof_review_note: 'Traduction wolof yi waare nettali ci locuteur yi soxor ci kanam ci production (spec 24.3).',
    data_not_translated: 'Xam-xam yi jëfandikoo yóbbu (tur, adres…) soxor di tradwii automatikamente.',
    doc_original_content: 'Dossier médicaux yi ak décision couverture yi dëkk wàllu contenu original bi. Traduction boo dees waare identifie.',
  },
  accessibility: {
    title: 'Accessibilité', readable_text: 'Xam-xam bobu xam', large_buttons: 'Bouton yi réy',
    color_contrast: 'Contraste baax', screen_reader: 'Lecteur écran dox ak',
    mobile_friendly: 'Confortable ci telefon bi', skip_to_content: 'Dem contenu principal bi',
    open_menu: 'Ubbi menu bi', close_menu: 'Tëj menu bi', image_alt: 'Texte image bi',
    required_field: 'Champ waajib', current_page: 'Laaj bi',
  },
}

const en: TranslationDict = {
  common: {
    save: 'Save', cancel: 'Cancel', back: 'Back', next: 'Next', close: 'Close',
    confirm: 'Confirm', delete: 'Delete', edit: 'Edit', view: 'View', search: 'Search',
    filter: 'Filter', loading: 'Loading…', error: 'Error', success: 'Success', yes: 'Yes', no: 'No',
    required: 'Required', optional: 'Optional', or: 'or', and: 'and', all: 'All',
    from: 'From', to: 'To', at: 'At', by: 'By', for: 'For', in: 'In',
    total: 'Total', none: 'None', unknown: 'Unknown', new: 'New',
    send: 'Send', submit: 'Submit', upload: 'Upload', download: 'Download', print: 'Print',
    add: 'Add', remove: 'Remove', update: 'Update', create: 'Create', refresh: 'Refresh',
    select: 'Select', deselect: 'Deselect', expand: 'Expand', collapse: 'Collapse',
    previous: 'Previous', next_page: 'Next', page: 'Page', of: 'of',
    approved: 'Approved', refused: 'Refused', pending: 'Pending',
  },
  nav: {
    dashboard: 'Dashboard', appointments: 'Appointments', patients: 'Patients',
    prescriptions: 'Prescriptions', documents: 'Documents', history: 'History',
    settings: 'Settings', logout: 'Log out', profile: 'Profile', notifications: 'Notifications',
    reservations: 'Reservations', stock: 'Stock', payments: 'Payments', coverage: 'Coverage',
    members: 'Members', requests: 'Requests', analytics: 'Analytics', support: 'Support',
    validation: 'Validation', disputes: 'Disputes', subscriptions: 'Subscriptions', audit: 'Audit',
    admins: 'Administrators', features: 'Features', parameters: 'Parameters',
  },
  actor: {
    patient: 'Patient', professional: 'Healthcare Professional', pharmacy: 'Pharmacy',
    establishment: 'Healthcare Facility', organisme: 'Coverage Organization',
    admin: 'Administrator', super_admin: 'Super Administrator',
  },
  status: {
    pending: 'Pending', confirmed: 'Confirmed', ready: 'Ready', collected: 'Collected',
    cancelled: 'Cancelled', expired: 'Expired', failed: 'Failed',
    submitted: 'Submitted', under_review: 'Under Review', approved: 'Approved',
    partially_approved: 'Partially Approved', rejected: 'Rejected', paid: 'Paid',
    partially_paid: 'Partially Paid', contested: 'Contested',
    trial: 'Trial', active: 'Active', payment_pending: 'Payment Pending',
    suspended: 'Suspended', cancelled_sub: 'Cancelled', expired_sub: 'Expired',
    initiated: 'Initiated', processing: 'Processing', completed: 'Completed',
    refunded: 'Refunded', disputed: 'Disputed',
    active_profile: 'Active', inactive_profile: 'Inactive', pending_verification: 'Pending Verification',
    info_required: 'Info Required', refused_profile: 'Refused',
    new_dispute: 'New', in_progress: 'In Progress', waiting: 'Waiting', resolved: 'Resolved', closed: 'Closed',
  },
  form: {
    name: 'Name', first_name: 'First Name', last_name: 'Last Name', email: 'Email', phone: 'Phone',
    address: 'Address', city: 'City', date: 'Date', time: 'Time', amount: 'Amount',
    description: 'Description', notes: 'Notes', reason: 'Reason', type: 'Type',
    password: 'Password', confirm_password: 'Confirm Password', birth_date: 'Date of Birth',
    gender: 'Gender', male: 'Male', female: 'Female',
    specialty: 'Specialty', license_number: 'License Number', rpps: 'RPPS Number',
    quantity: 'Quantity', unit: 'Unit', dosage: 'Dosage', duration: 'Duration',
    start_date: 'Start Date', end_date: 'End Date', expiry_date: 'Expiry Date',
    iban: 'IBAN', siret: 'SIRET', nif: 'NIF',
  },
  error: {
    required_field: 'This field is required', invalid_email: 'Invalid email address',
    invalid_phone: 'Invalid phone number', network_error: 'Network error, please try again',
    unauthorized: 'Access denied', not_found: 'Resource not found',
    server_error: 'Server error, please try again later', session_expired: 'Session expired, please log in again',
    invalid_format: 'Invalid format', too_short: 'Too short', too_long: 'Too long',
    passwords_mismatch: 'Passwords do not match',
    already_exists: 'Already exists', insufficient_permissions: 'Insufficient permissions',
  },
  appointment: {
    book: 'Book Appointment', cancel: 'Cancel Appointment', reschedule: 'Reschedule',
    confirm: 'Confirm Appointment', upcoming: 'Upcoming', past: 'Past', today: 'Today',
    no_slots: 'No available slots', reminder_sent: 'Reminder sent',
    teleconsultation: 'Teleconsultation', in_person: 'In Person',
  },
  prescription: {
    new: 'New Prescription', renew: 'Renew', valid_until: 'Valid until',
    prescribed_by: 'Prescribed by', medications: 'Medications', instructions: 'Instructions',
    send_to_pharmacy: 'Send to Pharmacy',
  },
  notification: {
    appointment_reminder: 'Appointment Reminder', reservation_ready: 'Reservation Ready for Pick-up',
    payment_confirmed: 'Payment Confirmed', coverage_decision: 'Coverage Decision',
    profile_validated: 'Profile Validated', new_message: 'New Message',
    subscription_expiring: 'Subscription Expiring Soon',
  },
  i18n: {
    language: 'Language', change_language: 'Change Language',
    wolof_review_note: 'Wolof translations must be reviewed by competent speakers before going live (spec 24.3).',
    data_not_translated: 'User-entered data (names, addresses…) is not automatically translated.',
    doc_original_content: 'Medical documents and coverage decisions keep their original content. Any translation is clearly labeled.',
  },
  accessibility: {
    title: 'Accessibility', readable_text: 'Readable text', large_buttons: 'Large enough buttons',
    color_contrast: 'Adequate color contrast', screen_reader: 'Screen reader compatible',
    mobile_friendly: 'Comfortable on small screens', skip_to_content: 'Skip to main content',
    open_menu: 'Open menu', close_menu: 'Close menu', image_alt: 'Image alt text',
    required_field: 'Required field', current_page: 'Current page',
  },
}

export const translations: Record<string, TranslationDict> = { fr, wo, en }
