package infres.ws.rest.java.rest.server.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/profil")
public class ProfilController {

    /**
     * Retourne le profil de l'utilisateur authentifié à partir des claims du JWT Keycloak.
     *
     * Claims standards utilisés :
     *   - "name"              : nom complet (claim standard OIDC)
     *   - "preferred_username": nom d'utilisateur Keycloak
     *   - "email"             : adresse e-mail
     * Pas de "picture" par défaut dans Keycloak (contrairement à Google),
     * mais on renvoie une chaîne vide pour ne pas casser le frontend.
     */
    @GetMapping
    public Map<String, Object> profile(@AuthenticationPrincipal Jwt jwt) {
        Map<String, Object> profileData = new HashMap<>();

        // Nom complet (claim OIDC standard)
        String name = jwt.getClaimAsString("name");
        if (name == null || name.isBlank()) {
            name = jwt.getClaimAsString("preferred_username");
        }
        profileData.put("name", name != null ? name : "Utilisateur");

        // Email
        String email = jwt.getClaimAsString("email");
        profileData.put("email", email != null ? email : "");

        // Keycloak ne fournit pas de photo de profil par défaut
        profileData.put("picture", "");

        return profileData;
    }
}
