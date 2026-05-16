# 🚀 Production Deployment Checklist
# EdTech Kurikulum Merdeka Security & Deployment Guide

## Phase 1: Pre-Deployment Security Validation

### Authentication & Authorization
- [ ] Firebase Project ID verified
- [ ] Service Account credentials valid
- [ ] Firebase Rules deployed to production
  ```bash
  firebase deploy --only firestore:rules --project <production-project>
  ```
- [ ] All API endpoints require Firebase token
- [ ] Test unauthorized access returns 401
  ```bash
  curl -X POST http://localhost:3000/api/generate-tp
  # Should return 401 Unauthorized
  ```

### Rate Limiting
- [ ] Redis instance provisioned (Upstash or similar)
- [ ] `UPSTASH_REDIS_REST_URL` set in production
- [ ] `UPSTASH_REDIS_REST_TOKEN` set in production
- [ ] Test rate limiting: make 6+ requests to same endpoint
  ```bash
  for i in {1..6}; do
    curl -H "Authorization: Bearer $TOKEN" \
      http://localhost:3000/api/generate-tp
  done
  # 6th request should return 429 Too Many Requests
  ```
- [ ] Rate limit headers present in response
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

### Error Handling
- [ ] All error messages are generic (no system details)
- [ ] Internal errors logged server-side
- [ ] No stack traces exposed to client
- [ ] Test error response:
  ```bash
  curl -X POST http://localhost:3000/api/generate-tp \
    -H "Authorization: Bearer invalid-token"
  # Should not expose internal server details
  ```

### Email Verification
- [ ] SMTP configured for production
  - `SMTP_HOST` set
  - `SMTP_USER` set
  - `SMTP_PASS` set
- [ ] Test email sending:
  ```bash
  # Create new account and verify email sends
  ```
- [ ] Email verification token expiry: 24 hours
- [ ] Rate limit on resend: 1 per hour
- [ ] Firestore `email_verifications` collection exists

### Audit Logging
- [ ] Firestore `audit_logs` collection configured
- [ ] Security rules applied:
  ```
  match /audit_logs/{logId} {
    allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
    allow create: if request.auth != null;
    allow update, delete: if false;
  }
  ```
- [ ] Test audit logging:
  ```bash
  # Perform action and check audit_logs in Firestore
  firebase console open --project <production-project>
  # Navigate to: Firestore > audit_logs > query by userId
  ```
- [ ] ENABLE_AUDIT_LOG=true in production env

### Password Security
- [ ] Password strength validation active
  - Minimum 8 characters
  - Uppercase, lowercase, number, special char required
- [ ] Test weak password rejected:
  ```bash
  # Try signup with "password" only
  # Should return validation error
  ```

### Environment Variables
- [ ] All required vars set (see .env.example)
- [ ] No unset required variables
- [ ] No hardcoded secrets in code
- [ ] Sensitive vars in secure environment manager
- [ ] Credentials rotated every 90 days

### CSRF Protection
- [ ] CSRF token endpoint working
  ```bash
  curl http://localhost:3000/api/csrf-token
  # Should return token in response & cookie
  ```
- [ ] CSRF_TOKEN_EXPIRY_MS set appropriately
- [ ] ENABLE_CSRF_PROTECTION=true

---

## Phase 2: API Endpoint Validation

### All Endpoints Secured
- [ ] `POST /api/generate-tp` - Auth ✅, Rate limit ✅, Audit ✅
- [ ] `POST /api/generate-soal` - Auth ✅, Rate limit ✅, Audit ✅
- [ ] `POST /api/koreksi` - Auth ✅, Rate limit ✅, Audit ✅, Authorization ✅
- [ ] `POST /api/rekap-nilai/export` - Auth ✅, Rate limit ✅, Audit ✅, Authorization ✅
- [ ] `POST /api/verify-email` - Rate limit ✅, Audit ✅
- [ ] `POST /api/resend-verification-email` - Auth ✅, Rate limit ✅, Audit ✅
- [ ] `GET /api/csrf-token` - Works ✅
- [ ] `GET /api/quota-status` - Works ✅

### Test Rate Limiting per Endpoint
```bash
TOKEN=$(firebase auth idtoken --project <project>)

# generate-tp: 5 req/min
for i in {1..6}; do curl -H "Authorization: Bearer $TOKEN" ...; done

# koreksi: 10 req/min
for i in {1..11}; do curl -H "Authorization: Bearer $TOKEN" ...; done

# rekap-nilai: 5 req/min
for i in {1..6}; do curl -H "Authorization: Bearer $TOKEN" ...; done
```

### Test Authorization
```bash
# Try to access/modify someone else's resource
# Should return 403 Forbidden
curl -X POST http://localhost:3000/api/koreksi \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -d '{"examId": "user_b_exam_id"}'
```

---

## Phase 3: Data & Infrastructure

### Firestore Configuration
- [ ] All collections created:
  - `users`
  - `classes`
  - `learning_goals`
  - `exams`
  - `audit_logs`
  - `email_verifications`
- [ ] Security rules deployed
- [ ] Backup enabled
  ```bash
  gcloud firestore backups create --database='(default)' --location='us-central1'
  ```
- [ ] Indexes created for queries
  ```bash
  firebase deploy --only firestore:indexes
  ```

### Redis Configuration (Production)
- [ ] Upstash Redis instance provisioned
- [ ] Connection tested:
  ```bash
  curl https://your-redis-url/ping \
    -H "Authorization: Bearer your_token"
  # Should return "+PONG"
  ```
- [ ] TTL configured for rate limit keys
- [ ] Monitoring alerts set up

### Firebase Authentication
- [ ] Email/password authentication enabled
- [ ] Google Sign-in configured
- [ ] Password reset flow tested
- [ ] Email verification required for dashboard
- [ ] Session timeout configured: 30 min

---

## Phase 4: Security Testing

### Load Testing
```bash
# Install Apache Bench
# Test rate limiting under load
ab -n 100 -c 10 -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/generate-tp

# Should handle gracefully with 429 responses
```

### SQL/NoSQL Injection Testing
- [ ] Test various payloads in form fields
- [ ] Firestore queries use proper type validation
- [ ] No dynamic query construction

### XSS Prevention
- [ ] React components use proper escaping
- [ ] No dangerouslySetInnerHTML usage
- [ ] Content Security Policy headers set

### CSRF Testing
- [ ] CSRF token required for state-changing requests
- [ ] Token expires after 1 hour
- [ ] Same-site cookie policy enforced

### Authentication Testing
- [ ] Firebase token validation working
- [ ] Expired tokens rejected
- [ ] Invalid tokens rejected
- [ ] Token refresh handled

---

## Phase 5: Performance Optimization

### Rate Limiter Performance
- [ ] Redis response time < 100ms
- [ ] In-memory fallback working if Redis unavailable
- [ ] No memory leaks in production

### Query Optimization
- [ ] Firestore indexes created for frequent queries
- [ ] No N+1 query problems
- [ ] Batch operations used where applicable

### Error Handling Performance
- [ ] Errors logged asynchronously (non-blocking)
- [ ] Audit logging non-blocking
- [ ] No performance degradation on errors

---

## Phase 6: Monitoring & Alerting

### Logging
- [ ] Error logs monitored
- [ ] Audit logs reviewed daily
- [ ] Rate limit violations logged
- [ ] Failed authentication logged

### Alerts
- [ ] Alert on multiple failed logins (possible brute force)
- [ ] Alert on unusual rate limit hits
- [ ] Alert on API quota exhaustion
- [ ] Alert on Redis connection failures
- [ ] Alert on Firebase Rule violations

### Metrics to Track
- [ ] Daily active users
- [ ] API response times
- [ ] Error rate (target: < 1%)
- [ ] Rate limit hits (target: < 5%)
- [ ] Email verification rate
- [ ] Audit log entries per day

---

## Phase 7: Documentation & Training

- [ ] Deployment documentation updated
- [ ] Security policies documented
- [ ] Incident response plan created
- [ ] Team trained on security features
- [ ] Runbook created for common issues

---

## Phase 8: Final Verification

### Pre-Launch Checklist
- [ ] Code reviewed and tested
- [ ] All tests passing
- [ ] No console warnings or errors
- [ ] Database backups working
- [ ] Monitoring configured
- [ ] Incident response plan ready
- [ ] Team on-call schedule set

### Launch Checklist
- [ ] Deploy to production
- [ ] Verify all endpoints working
- [ ] Monitor error logs
- [ ] Confirm emails sending
- [ ] Check audit logs for activity
- [ ] Verify rate limiting active
- [ ] Test user can complete signup → verification → login → access dashboard

### Post-Launch Checklist
- [ ] Monitor for 24 hours
- [ ] Check daily active users
- [ ] Review error logs
- [ ] Verify rate limiting working
- [ ] Confirm backup jobs running
- [ ] Plan post-launch review meeting

---

## Rollback Plan

If issues occur:

1. **Immediately**: Alert team, disable traffic to affected endpoint
2. **Within 5 min**: Investigate error logs, check recent changes
3. **Within 15 min**: Decide: fix or rollback
4. **Rollback**:
   ```bash
   # Revert to last known good version
   git revert <commit-hash>
   npm run build
   firebase deploy --only functions:
   ```
5. **Post-incident**: Analyze root cause, add test coverage

---

## Security Review Cadence

- **Weekly**: Review audit logs and error logs
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Full security audit
- **Annually**: Red team exercise or penetration test

---

## Contact & Support

- **Security Issues**: security@edtech-km.local
- **Production Support**: support@edtech-km.local
- **On-call**: Check Slack #on-call channel

---

**Last Updated**: December 5, 2024  
**Version**: 1.0  
**Next Review**: December 12, 2024
