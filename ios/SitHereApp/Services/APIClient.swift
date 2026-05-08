import Foundation

final class APIClient {
    private let environment: AppEnvironment
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(environment: AppEnvironment) {
        self.environment = environment
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .custom { decoder in
            let value = try decoder.singleValueContainer().decode(String.self)
            if let date = ISO8601DateFormatter.withFractionalSeconds.date(from: value) {
                return date
            }
            if let date = ISO8601DateFormatter.standard.date(from: value) {
                return date
            }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Invalid ISO8601 date: \(value)"))
        }
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
    }

    func me(token: String) async throws -> MeResponse {
        try await request("me", token: token, as: MeEnvelope.self).payload
    }

    func postMe(token: String, fullName: String, role: UserRole) async throws -> Profile {
        try await request("me", method: "POST", token: token, body: ["fullName": fullName, "role": role.rawValue], as: ProfileEnvelope.self).profile
    }

    func createPet(token: String, name: String, breed: String) async throws -> Pet {
        try await request("pets", method: "POST", token: token, body: ["name": name, "breed": breed], as: PetEnvelope.self).pet
    }

    func walkers(token: String) async throws -> [WalkerProfile] {
        try await request("walkers", token: token, as: WalkersEnvelope.self).walkers
    }

    func createWalkRequest(token: String, petId: UUID, walkerId: UUID, startAt: Date, duration: Int, address: String) async throws -> WalkRequest {
        let body: [String: EncodableValue] = [
            "petId": .string(petId.uuidString),
            "walkerId": .string(walkerId.uuidString),
            "requestedStartAt": .string(ISO8601DateFormatter().string(from: startAt)),
            "durationMinutes": .int(duration),
            "address": .string(address)
        ]
        return try await request("walk-requests", method: "POST", token: token, body: body, as: WalkRequestEnvelope.self).walkRequest
    }

    func updateWalkStatus(token: String, walkRequestId: UUID, status: WalkStatus) async throws -> WalkRequest {
        try await request("walk-requests/\(walkRequestId.uuidString)/status", method: "PATCH", token: token, body: ["status": status.rawValue], as: WalkRequestEnvelope.self).walkRequest
    }

    func startWalkSession(token: String, walkRequestId: UUID) async throws -> WalkSession {
        try await request("walk-sessions", method: "POST", token: token, body: ["walkRequestId": walkRequestId.uuidString], as: WalkSessionEnvelope.self).walkSession
    }

    func postLocation(token: String, sessionId: UUID, latitude: Double, longitude: Double, elapsed: Int, distance: Double) async throws -> LiveLocation {
        let body: [String: EncodableValue] = [
            "latitude": .double(latitude),
            "longitude": .double(longitude),
            "elapsedSeconds": .int(elapsed),
            "distanceMiles": .double(distance)
        ]
        return try await request("walk-sessions/\(sessionId.uuidString)/location", method: "POST", token: token, body: body, as: LiveLocationEnvelope.self).liveLocation
    }

    func liveLocation(token: String, sessionId: UUID) async throws -> LiveLocation? {
        try await request("walk-sessions/\(sessionId.uuidString)/location", token: token, as: LiveLocationEnvelope.self).liveLocation
    }

    func sendReport(token: String, walkSessionId: UUID, mood: String, notes: String) async throws -> Report {
        try await request("reports", method: "POST", token: token, body: ["walkSessionId": walkSessionId.uuidString, "mood": mood, "notes": notes], as: ReportEnvelope.self).report
    }

    func conversations(token: String) async throws -> [Conversation] {
        try await request("conversations", token: token, as: ConversationsEnvelope.self).conversations
    }

    func messages(token: String, conversationId: UUID) async throws -> [Message] {
        try await request("conversations/\(conversationId.uuidString)/messages", token: token, as: MessagesEnvelope.self).messages
    }

    func sendMessage(token: String, conversationId: UUID, body: String) async throws -> Message {
        try await request("messages", method: "POST", token: token, body: ["conversationId": conversationId.uuidString, "body": body], as: MessageEnvelope.self).message
    }

    func paymentIntent(token: String, walkRequestId: UUID) async throws -> PaymentIntentEnvelope {
        try await request("payments/payment-intent", method: "POST", token: token, body: ["walkRequestId": walkRequestId.uuidString], as: PaymentIntentEnvelope.self)
    }

    func registerDeviceToken(token: String, deviceToken: String, environmentName: String) async throws {
        let _: DeviceTokenEnvelope = try await request("device-tokens", method: "POST", token: token, body: ["token": deviceToken, "environment": environmentName], as: DeviceTokenEnvelope.self)
    }

    func deleteAccount(token: String) async throws {
        let _: DeleteAccountEnvelope = try await request("me", method: "DELETE", token: token, as: DeleteAccountEnvelope.self)
    }

    func vets(token: String) async throws -> [VetLocation] {
        try await request("vets", token: token, as: VetsEnvelope.self).vets
    }

    private func request<T: Decodable>(_ path: String, method: String = "GET", token: String, as type: T.Type) async throws -> T {
        try await request(path, method: method, token: token, body: Optional<EmptyRequest>.none, as: type)
    }

    private func request<T: Decodable, Body: Encodable>(_ path: String, method: String = "GET", token: String, body: Body?, as type: T.Type) async throws -> T {
        let base = environment.apiBaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: "\(base)/v1/\(path)") else { throw AppError.invalidResponse }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body {
            request.httpBody = try encoder.encode(body)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AppError.invalidResponse }
        if !(200..<300).contains(http.statusCode) {
            let err = try? decoder.decode(ServerErrorEnvelope.self, from: data)
            throw AppError.server(err?.error ?? "Request failed with HTTP \(http.statusCode).")
        }
        return try decoder.decode(T.self, from: data)
    }
}

private struct EmptyRequest: Encodable {}

enum EncodableValue: Encodable {
    case string(String)
    case int(Int)
    case double(Double)

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .int(let value): try container.encode(value)
        case .double(let value): try container.encode(value)
        }
    }
}

private struct ServerErrorEnvelope: Codable { var error: String? }
private struct MeEnvelope: Codable { var payload: MeResponse
    init(from decoder: Decoder) throws { payload = try MeResponse(from: decoder) }
}
private struct ProfileEnvelope: Codable { var profile: Profile }
private struct PetEnvelope: Codable { var pet: Pet }
private struct WalkersEnvelope: Codable { var walkers: [WalkerProfile] }
private struct WalkRequestEnvelope: Codable { var walkRequest: WalkRequest }
private struct WalkSessionEnvelope: Codable { var walkSession: WalkSession }
private struct LiveLocationEnvelope: Codable { var liveLocation: LiveLocation? }
private struct ReportEnvelope: Codable { var report: Report }
private struct ConversationsEnvelope: Codable { var conversations: [Conversation] }
private struct MessagesEnvelope: Codable { var messages: [Message] }
private struct MessageEnvelope: Codable { var message: Message }
struct PaymentIntentEnvelope: Codable { var clientSecret: String }
private struct DeviceTokenEnvelope: Codable { var deviceToken: EmptyObject? }
private struct DeleteAccountEnvelope: Codable { var success: Bool }
private struct VetsEnvelope: Codable { var vets: [VetLocation] }

private extension ISO8601DateFormatter {
    static let standard: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static let withFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
