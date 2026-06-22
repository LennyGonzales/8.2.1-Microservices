package infres.ws.rest.java.rest.server.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/profil")
public class ProfilController {

    @GetMapping
    public Map<String, Object> profile(@AuthenticationPrincipal OidcUser user) {
        return Map.of(
                "name", Objects.requireNonNull(user.getFullName()),
                "email", Objects.requireNonNull(user.getEmail()),
                "picture", Objects.requireNonNull(user.getPicture())
        );
    }
}
