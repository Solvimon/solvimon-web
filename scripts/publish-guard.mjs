if (!process.env.GITLAB_CI) {
    console.error('Publishing @solvimon/solvimon-web is only allowed from GitLab CI.');
    process.exit(1);
}
