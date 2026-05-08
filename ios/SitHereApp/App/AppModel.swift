import Foundation

@MainActor
final class AppModel: ObservableObject {
    @Published var session: AuthSession?
    @Published var me: MeResponse?
    @Published var isLoading = false
    @Published var errorMessage: String?

    let authService: AuthService
    let apiClient: APIClient
    let locationService: LocationService
    let pushService: PushService
    let paymentsService: PaymentsService
    let photoUploadService: PhotoUploadService

    init(environment: AppEnvironment = .production) {
        self.authService = AuthService(environment: environment)
        self.apiClient = APIClient(environment: environment)
        self.locationService = LocationService()
        self.pushService = PushService()
        self.paymentsService = PaymentsService()
        self.photoUploadService = PhotoUploadService(environment: environment)
    }

    var role: UserRole {
        me?.profile.role ?? .owner
    }

    func restoreSession() async {
        session = authService.loadStoredSession()
        guard session != nil else { return }
        await refreshMe()
    }

    func signIn(email: String, password: String) async {
        await run {
            let newSession = try await authService.signIn(email: email, password: password)
            session = newSession
            try authService.store(session: newSession)
            await refreshMe()
        }
    }

    func signUp(name: String, email: String, password: String, role: UserRole) async {
        await run {
            let newSession = try await authService.signUp(name: name, email: email, password: password)
            session = newSession
            try authService.store(session: newSession)
            _ = try await apiClient.postMe(token: newSession.accessToken, fullName: name, role: role)
            await refreshMe()
        }
    }

    func signOut() {
        authService.clearStoredSession()
        session = nil
        me = nil
    }

    func refreshMe() async {
        guard let token = session?.accessToken else { return }
        await run {
            me = try await apiClient.me(token: token)
        }
    }

    func tokenOrThrow() throws -> String {
        guard let token = session?.accessToken else { throw AppError.unauthorized }
        return token
    }

    private func run(_ operation: () async throws -> Void) async {
        isLoading = true
        errorMessage = nil
        do {
            try await operation()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
