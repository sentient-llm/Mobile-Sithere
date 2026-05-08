import AuthenticationServices
import Foundation
import Security

final class AuthService {
    private let environment: AppEnvironment
    private let keychainKey = "sit-here.auth-session"

    init(environment: AppEnvironment) {
        self.environment = environment
    }

    func signIn(email: String, password: String) async throws -> AuthSession {
        let url = environment.supabaseURL.appending(path: "/auth/v1/token")
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "password")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(environment.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(PasswordAuthBody(email: email, password: password))
        return try await decodeAuth(request)
    }

    func signUp(name: String, email: String, password: String) async throws -> AuthSession {
        var request = URLRequest(url: environment.supabaseURL.appending(path: "/auth/v1/signup"))
        request.httpMethod = "POST"
        request.setValue(environment.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(SignUpBody(email: email, password: password, data: ["name": name]))
        return try await decodeAuth(request)
    }

    func signInWithAppleCredential(_ credential: ASAuthorizationAppleIDCredential) async throws -> AuthSession {
        guard let tokenData = credential.identityToken, let idToken = String(data: tokenData, encoding: .utf8) else {
            throw AppError.invalidResponse
        }
        let url = environment.supabaseURL.appending(path: "/auth/v1/token")
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "id_token")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(environment.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(AppleAuthBody(provider: "apple", idToken: idToken))
        return try await decodeAuth(request)
    }

    func store(session: AuthSession) throws {
        let data = try JSONEncoder().encode(session)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: keychainKey,
            kSecValueData as String: data
        ]
        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw AppError.server("Unable to store session in Keychain.") }
    }

    func loadStoredSession() -> AuthSession? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: keychainKey,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return try? JSONDecoder().decode(AuthSession.self, from: data)
    }

    func clearStoredSession() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: keychainKey
        ]
        SecItemDelete(query as CFDictionary)
    }

    private func decodeAuth(_ request: URLRequest) async throws -> AuthSession {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AppError.invalidResponse }
        if !(200..<300).contains(http.statusCode) {
            let err = try? JSONDecoder().decode(ServerError.self, from: data)
            throw AppError.server(err?.message ?? err?.error ?? "Authentication failed.")
        }
        let auth = try JSONDecoder().decode(AuthResponse.self, from: data)
        return AuthSession(
            accessToken: auth.accessToken,
            refreshToken: auth.refreshToken,
            expiresAt: auth.expiresIn.map { Date().addingTimeInterval(TimeInterval($0)) }
        )
    }
}

private struct AuthResponse: Codable {
    var accessToken: String
    var refreshToken: String?
    var expiresIn: Int?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
    }
}

private struct PasswordAuthBody: Codable {
    var email: String
    var password: String
}

private struct SignUpBody: Codable {
    var email: String
    var password: String
    var data: [String: String]
}

private struct AppleAuthBody: Codable {
    var provider: String
    var idToken: String

    enum CodingKeys: String, CodingKey {
        case provider
        case idToken = "id_token"
    }
}

private struct ServerError: Codable {
    var error: String?
    var message: String?
}
