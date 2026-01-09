# Workflow Git - Fork Alane38/webstudio

## Configuration actuelle

```
origin   → https://github.com/Alane38/webstudio.git     (TON fork)
upstream → https://github.com/webstudio-is/webstudio.git (repo officiel)
```

## Commandes quotidiennes

### Commit et push sur ton fork

```bash
# 1. Voir les changements
git status

# 2. Ajouter les fichiers
git add <fichiers>
# ou tout ajouter (attention aux secrets)
git add .

# 3. Commit
git commit -m "feat(scope): description"

# 4. Push sur ton fork
git push origin main
```

### Créer une branche feature

```bash
# Créer et switch sur une nouvelle branche
git checkout -b feature/ma-feature

# Travailler, commit...
git add .
git commit -m "feat: ma feature"

# Push la branche sur ton fork
git push -u origin feature/ma-feature
```

### Créer une PR (sur ton fork uniquement)

```bash
# PR de ta branche vers ton main
gh pr create --repo Alane38/webstudio --base main --head feature/ma-feature
```

## Synchroniser avec le repo officiel

Si tu veux récupérer les mises à jour du projet officiel :

```bash
# Récupérer les changements de l'officiel
git fetch upstream

# Merger dans ton main
git checkout main
git merge upstream/main

# Push sur ton fork
git push origin main
```

## Fichiers à ne JAMAIS commit

```
apps/builder/.env          # Secrets
https/*.pem                # Certificats SSL
webstudio-static-export/   # Output généré
```

## Vérifier ta config

```bash
# Voir les remotes
git remote -v

# Doit afficher :
# origin   https://github.com/Alane38/webstudio.git
# upstream https://github.com/webstudio-is/webstudio.git
```

## En cas de problème

```bash
# Si origin pointe vers le mauvais repo
git remote set-url origin https://github.com/Alane38/webstudio.git

# Si tu as push par erreur sur upstream (ne devrait pas arriver)
# Contacte les mainteneurs du projet officiel
```
