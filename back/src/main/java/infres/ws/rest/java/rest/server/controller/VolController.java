package infres.ws.rest.java.rest.server.controller;

import infres.ws.rest.java.rest.server.model.Vol;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/vol")
public class VolController {

    @GetMapping
    public List<Vol> getAllVols() {
        return List.of(
                new Vol("Air France", "AF123", "12A", 350.0, "2024-07-01"),
                new Vol("Delta Airlines", "DL456", "14B", 450.0, "2024-07-02"),
                new Vol("Lufthansa", "LH789", "16C", 400.0, "2024-07-03")
        );
    }
}
