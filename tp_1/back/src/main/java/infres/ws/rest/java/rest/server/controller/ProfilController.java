package infres.ws.rest.java.rest.server.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/profil")
public class ProfilController {

    @GetMapping
    public Map<String, Object> profile(@AuthenticationPrincipal OidcUser user) {
        Map<String, Object> profileData = new HashMap<>();
        profileData.put("name", user.getFullName() != null ? user.getFullName() : "Utilisateur");
        profileData.put("email", user.getEmail() != null ? user.getEmail() : "");
        profileData.put("picture", user.getPicture() != null ? user.getPicture() : "");
        return profileData;
    }
}
