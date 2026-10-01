# Mise à jour des noms de tables français dans tout le code TypeScript/JavaScript
# À exécuter depuis la racine du projet : .\scripts\rename-tables-code.ps1

$rootDir = Join-Path $PSScriptRoot ".."
$appsDir = Join-Path $rootDir "apps\web\src"

# Correspondance ancien nom → nouveau nom (du plus long au plus court pour éviter les sous-chaînes)
$replacements = @(
    # Noms composés (traiter en premier)
    @{ Old = "professional_establishment_memberships"; New = "affiliations_etablissement" },
    @{ Old = "patient_beneficiaries"; New = "beneficiaires" },
    @{ Old = "patient_consents"; New = "consentements" },
    @{ Old = "professional_qualifications"; New = "qualifications_professionnelles" },
    @{ Old = "professional_specialties"; New = "specialites_professionnelles" },
    @{ Old = "pharmacy_reservation_items"; New = "articles_reservation" },
    @{ Old = "pharmacy_reservations"; New = "reservations_pharmacie" },
    @{ Old = "pharmacy_stock_movements"; New = "mouvements_stock" },
    @{ Old = "pharmacy_stock"; New = "stock_pharmacie" },
    @{ Old = "pharmacy_products"; New = "produits_pharmacie" },
    @{ Old = "establishment_services"; New = "services_etablissement" },
    @{ Old = "coverage_decisions"; New = "decisions_couverture" },
    @{ Old = "coverage_requests"; New = "demandes_couverture" },
    @{ Old = "coverage_members"; New = "adherents_couverture" },
    @{ Old = "coverage_rules"; New = "regles_couverture" },
    @{ Old = "coverage_plans"; New = "formules_couverture" },
    @{ Old = "coverage_orgs"; New = "organismes_couverture" },
    @{ Old = "prescription_items"; New = "articles_ordonnance" },
    @{ Old = "prescriptions"; New = "ordonnances" },
    @{ Old = "payment_events"; New = "evenements_paiement" },
    @{ Old = "health_record_entries"; New = "entrees_dossiers" },
    @{ Old = "health_records"; New = "dossiers_medicaux" },
    @{ Old = "schedule_exceptions"; New = "exceptions_planning" },
    @{ Old = "schedule_slots"; New = "creneaux_planning" },
    @{ Old = "schedules"; New = "plannings" },
    @{ Old = "appointments"; New = "rendez_vous" },
    @{ Old = "establishments"; New = "etablissements" },
    @{ Old = "professionals"; New = "professionnels" },
    @{ Old = "profiles"; New = "profils" },
    @{ Old = "payments"; New = "paiements" },
    @{ Old = "subscriptions"; New = "abonnements" },
    @{ Old = "notification_preferences"; New = "preferences_notifications" },
    @{ Old = "litige_messages"; New = "messages_litige" },
    @{ Old = "audit_logs"; New = "journaux_audit" },
    @{ Old = "event_logs"; New = "journaux_evenements" },
    @{ Old = "reviews"; New = "avis" },
    @{ Old = "review_replies"; New = "reponses_avis" },
    @{ Old = "pricing_plans"; New = "grilles_tarifs" },
    @{ Old = "verification_tokens"; New = "jetons_verification" },
    @{ Old = "reservation_expiry_jobs"; New = "expirations_reservations" },
    @{ Old = "system_events"; New = "evenements_systeme" },
    @{ Old = "platform_settings"; New = "parametres_plateforme" },
    @{ Old = "feature_flags"; New = "drapeaux_fonctionnalites" },
    @{ Old = "archived_profiles"; New = "profils_archives" },
    @{ Old = "login_attempts"; New = "tentatives_connexion" },
    @{ Old = "invoices"; New = "factures" },
    @{ Old = "refunds"; New = "remboursements" }
    # Tables inchangées : patients, pharmacies, consultations, notifications, documents,
    # litiges, messages, teleconsultation_sessions
)

$files = Get-ChildItem -Path $appsDir -Recurse -Include "*.ts","*.tsx" -File
$totalFiles = $files.Count
$modifiedFiles = 0

Write-Host "Traitement de $totalFiles fichiers..." -ForegroundColor Cyan

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    $original = $content
    $changed = $false

    foreach ($r in $replacements) {
        $old = $r.Old
        $new = $r.New

        # Remplacer uniquement dans les contextes .from('...'), .from("...")
        # et aussi dans les chaînes TypeScript de type de table
        $patterns = @(
            "\.from\('$old'\)",
            "\.from\(`"$old`"\)",
            "supabase\.from\('$old'\)",
            "supabase\.from\(`"$old`"\)"
        )

        # Remplacement ciblé sur .from('table')
        $newContent = $content -replace "\.from\('$old'\)", ".from('$new')"
        $newContent = $newContent -replace '\.from\("' + $old + '"\)', ".from(`"$new`")"

        if ($newContent -ne $content) {
            $content = $newContent
            $changed = $true
        }
    }

    if ($changed) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        $modifiedFiles++
        Write-Host "  Mis à jour: $($file.FullName.Replace($rootDir, ''))" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Terminé : $modifiedFiles fichiers modifiés sur $totalFiles." -ForegroundColor Cyan
