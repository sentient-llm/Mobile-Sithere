import AuthenticationServices
import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var model: AppModel
    @State private var mode: Mode = .signIn
    @State private var role: UserRole = .owner
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""

    enum Mode { case signIn, signUp }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Sit-Here")
                            .font(.largeTitle.bold())
                        Text("Dog walking, handled calmly.")
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 8)
                }

                Section {
                    Picker("Mode", selection: $mode) {
                        Text("Sign In").tag(Mode.signIn)
                        Text("Create Account").tag(Mode.signUp)
                    }
                    .pickerStyle(.segmented)

                    if mode == .signUp {
                        TextField("Full name", text: $name)
                        Picker("I am a", selection: $role) {
                            Text("Dog owner").tag(UserRole.owner)
                            Text("Dog walker").tag(UserRole.walker)
                        }
                    }

                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                    SecureField("Password", text: $password)
                }

                Section {
                    Button {
                        Task {
                            if mode == .signIn {
                                await model.signIn(email: email, password: password)
                            } else {
                                await model.signUp(name: name, email: email, password: password, role: role)
                            }
                        }
                    } label: {
                        if model.isLoading {
                            ProgressView()
                        } else {
                            Text(mode == .signIn ? "Sign In" : "Create Account")
                        }
                    }
                    .disabled(email.isEmpty || password.isEmpty || (mode == .signUp && name.isEmpty))

                    SignInWithAppleButton(.continue) { _ in
                    } onCompletion: { _ in
                        model.errorMessage = "Apple sign-in is wired for entitlement setup; configure the Supabase Apple provider before enabling this button."
                    }
                    .frame(height: 48)
                }
            }
            .navigationTitle("Welcome")
        }
    }
}
