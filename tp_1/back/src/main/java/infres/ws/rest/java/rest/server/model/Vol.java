package infres.ws.rest.java.rest.server.model;

public record Vol(
    String compagnieAerienne,
    String numeroVol,
    String place,
    double prix,
    String date
) {
}
