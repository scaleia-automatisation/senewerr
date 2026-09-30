-- ─── Plans tarifaires initiaux ────────────────────────────────────────────

insert into pricing_plans (actor_type, plan_name, display_name, description, price_monthly_fcfa, price_yearly_fcfa, features, sort_order) values

-- Pharmacies
('pharmacie', 'decouverte', 'Découverte', 'Pour démarrer gratuitement', 0, 0,
  '["Catalogue jusqu''à 50 produits","1 pharmacien","Réservations illimitées"]', 0),

('pharmacie', 'start', 'Start', 'Pour les petites pharmacies', 15000, 150000,
  '["Catalogue jusqu''à 200 produits","2 pharmaciens","Réservations illimitées","Scan ordonnances"]', 1),

('pharmacie', 'pro', 'Pro', 'Pour les pharmacies établies', 35000, 350000,
  '["Catalogue illimité","5 pharmaciens","Réservations illimitées","Scan ordonnances","Gestion stock avancée","Rapports et statistiques"]', 2),

('pharmacie', 'premium', 'Premium', 'Pour les groupes pharmaceutiques', 75000, 750000,
  '["Tout du plan Pro","Pharmaciens illimités","API d''intégration","Support dédié","Formations équipe"]', 3),

-- Professionnels de santé
('sante', 'essentiel', 'Essentiel', 'Pour démarrer', 10000, 100000,
  '["Agenda en ligne","Téléconsultation","Ordonnances numériques","20 patients/mois"]', 0),

('sante', 'pro', 'Pro', 'Pour les professionnels actifs', 25000, 250000,
  '["Tout Essentiel","Patients illimités","Dossiers médicaux","Rappels automatiques","Statistiques"]', 1),

('sante', 'premium', 'Premium', 'Pour les cabinets groupés', 55000, 550000,
  '["Tout Pro","Multi-praticiens","Agenda partagé","API partenaires","Support prioritaire"]', 2),

-- Établissements
('sante', 'cabinet', 'Cabinet', 'Pour les petits cabinets', 30000, 300000,
  '["Jusqu''à 3 praticiens","Agenda multi-praticien","Gestion patients","Ordonnances"]', 0),

('sante', 'clinique', 'Clinique', 'Pour les cliniques', 80000, 800000,
  '["Jusqu''à 15 praticiens","Gestion des services","Hospitalisation","Rapports avancés"]', 1),

('sante', 'hopital', 'Hôpital', 'Pour les structures hospitalières', 200000, 2000000,
  '["Praticiens illimités","Modules complets","Intégrations lab/radio","Formation équipe","Support 24h"]', 2),

-- Couverture (mutuelles, IPM, assurances)
('couverture', 'essentiel', 'Essentiel', 'Gestion simple des adhérents', 20000, 200000,
  '["Jusqu''à 500 adhérents","Prises en charge pharmacie","Rapports mensuels"]', 0),

('couverture', 'pro', 'Pro', 'Pour les mutuelles actives', 50000, 500000,
  '["Jusqu''à 5 000 adhérents","Prises en charge multi-services","API employeur","Rapports avancés"]', 1),

('couverture', 'premium', 'Premium', 'Pour les grands organismes', 120000, 1200000,
  '["Adhérents illimités","Intégrations entreprises","Tableaux de bord personnalisés","Support dédié"]', 2);
