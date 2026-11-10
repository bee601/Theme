<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>{{ config('app.name', 'Pterodactyl') }} - @yield('title')</title>
        <meta content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
        <meta name="_token" content="{{ csrf_token() }}">

        <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
        <link rel="icon" type="image/png" href="/favicons/favicon-32x32.png" sizes="32x32">
        <link rel="icon" type="image/png" href="/favicons/favicon-16x16.png" sizes="16x16">
        <link rel="manifest" href="/favicons/manifest.json">
        <link rel="mask-icon" href="/favicons/safari-pinned-tab.svg" color="#bc6e3c">
        <link rel="shortcut icon" href="/favicons/favicon.ico">
        <meta name="msapplication-config" content="/favicons/browserconfig.xml">
        <meta name="theme-color" content="#0e4688">

        @include('layouts.scripts')

        @section('scripts')
            {!! Theme::css('vendor/select2/select2.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/bootstrap/bootstrap.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/adminlte/admin.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/adminlte/colors/skin-blue.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/sweetalert/sweetalert.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/animate/animate.min.css?t={cache-version}') !!}
            {!! Theme::css('css/pterodactyl.css?t={cache-version}') !!}
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/ionicons/2.0.1/css/ionicons.min.css">
            <style>
                body.nook-admin {
                    background: #0f172a;
                    color: #e2e8f0;
                }
                .nook-admin .main-header .logo,
                .nook-admin .main-header .navbar,
                .nook-admin .main-sidebar,
                .nook-admin .left-side {
                    background: #111827;
                }
                .nook-admin .main-header .logo {
                    color: #f8fafc;
                    border-bottom: 1px solid #1f2937;
                    border-right: 1px solid #1f2937;
                    font-weight: 600;
                }
                .nook-admin .main-header .navbar {
                    border-bottom: 1px solid #1f2937;
                }
                .nook-admin .main-header .navbar .sidebar-toggle,
                .nook-admin .main-header .navbar .nav > li > a {
                    color: #cbd5e1;
                }
                .nook-admin .main-header .navbar .sidebar-toggle:hover,
                .nook-admin .main-header .navbar .nav > li > a:hover {
                    background: #1f2937;
                    color: #fff;
                }
                .nook-admin .content-wrapper,
                .nook-admin .right-side {
                    background: #0f172a;
                }
                .nook-admin .content-header,
                .nook-admin .content-header > h1,
                .nook-admin .content-header > h1 > small {
                    color: #e2e8f0;
                }
                .nook-admin .sidebar-menu > li.header {
                    background: transparent;
                    color: #64748b;
                }
                .nook-admin .sidebar-menu > li > a {
                    color: #cbd5e1;
                    border-left: 3px solid transparent;
                }
                .nook-admin .sidebar-menu > li:hover > a,
                .nook-admin .sidebar-menu > li.active > a {
                    background: #1f2937;
                    color: #fff;
                    border-left-color: #22d3ee;
                }
                .nook-admin .main-footer {
                    background: #111827;
                    color: #94a3b8;
                    border-top: 1px solid #1f2937;
                }
                .nook-admin .box,
                .nook-admin .small-box,
                .nook-admin .info-box,
                .nook-admin .callout {
                    color: #e2e8f0;
                    background: #111827;
                    border: 1px solid #1f2937;
                    box-shadow: none;
                }
                .nook-admin .box-header,
                .nook-admin .box-footer {
                    background: #111827;
                    color: #e2e8f0;
                    border-color: #1f2937;
                }
                .nook-admin .box-title,
                .nook-admin label,
                .nook-admin .control-label {
                    color: #e2e8f0;
                }
                .nook-admin .table,
                .nook-admin .table > thead > tr > th,
                .nook-admin .table > tbody > tr > td {
                    color: #cbd5e1;
                    border-color: #273449;
                }
                .nook-admin .table > thead > tr > th {
                    color: #f1f5f9;
                }
                .nook-admin .table-striped > tbody > tr:nth-of-type(odd),
                .nook-admin .table-hover > tbody > tr:hover {
                    background: #172033;
                }
                .nook-admin .form-control,
                .nook-admin .select2-container--default .select2-selection--single {
                    background: #0f172a;
                    color: #e2e8f0;
                    border-color: #334155;
                }
                .nook-admin .form-control:focus {
                    border-color: #22d3ee;
                    box-shadow: 0 0 0 2px rgba(34, 211, 238, .15);
                }
                .nook-admin .btn-primary,
                .nook-admin .btn-info {
                    background: #0891b2;
                    border-color: #0891b2;
                }
                .nook-admin .btn-primary:hover,
                .nook-admin .btn-info:hover {
                    background: #0e7490;
                    border-color: #0e7490;
                }
                .nook-admin .btn {
                    color: #f8fafc;
                }
                .nook-admin .btn-default {
                    color: #e2e8f0;
                    background: #1f2937;
                    border-color: #334155;
                }
                .nook-admin .breadcrumb {
                    background: transparent;
                }
                .nook-admin .breadcrumb > .active,
                .nook-admin .text-muted,
                .nook-admin .help-block {
                    color: #94a3b8;
                }
                .nook-admin a {
                    color: #67e8f9;
                }
                .nook-admin a:hover {
                    color: #a5f3fc;
                }
                .nook-admin .modal-content,
                .nook-admin .dropdown-menu {
                    color: #e2e8f0;
                    background: #111827;
                    border-color: #334155;
                }
                .nook-admin .dropdown-menu > li > a {
                    color: #cbd5e1;
                }
                .nook-admin .dropdown-menu > li > a:hover {
                    background: #1f2937;
                    color: #fff;
                }
                .nook-admin hr {
                    border-color: #273449;
                }
            </style>

            <!--[if lt IE 9]>
            <script src="https://oss.maxcdn.com/html5shiv/3.7.3/html5shiv.min.js"></script>
            <script src="https://oss.maxcdn.com/respond/1.4.2/respond.min.js"></script>
            <![endif]-->
        @show
    </head>
    <body class="hold-transition skin-blue fixed sidebar-mini nook-admin">
        <div class="wrapper">
            <header class="main-header">
                <a href="{{ route('index') }}" class="logo">
                    <span>{{ config('app.name', 'Pterodactyl') }}</span>
                </a>
                <nav class="navbar navbar-static-top">
                    <a href="#" class="sidebar-toggle" data-toggle="push-menu" role="button">
                        <span class="sr-only">Toggle navigation</span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                    </a>
                    <div class="navbar-custom-menu">
                        <ul class="nav navbar-nav">
                            <li class="user-menu">
                                <a href="{{ route('account') }}">
                                    <img src="https://www.gravatar.com/avatar/{{ md5(strtolower(Auth::user()->email)) }}?s=160" class="user-image" alt="User Image">
                                    <span class="hidden-xs">{{ Auth::user()->name_first }} {{ Auth::user()->name_last }}</span>
                                </a>
                            </li>
                            <li>
                                <li><a href="{{ route('index') }}" data-toggle="tooltip" data-placement="bottom" title="Exit Admin Control"><i class="fa fa-server"></i></a></li>
                            </li>
                            <li>
                                <li><a href="{{ route('auth.logout') }}" id="logoutButton" data-toggle="tooltip" data-placement="bottom" title="Logout"><i class="fa fa-sign-out"></i></a></li>
                            </li>
                        </ul>
                    </div>
                </nav>
            </header>
            <aside class="main-sidebar">
                <section class="sidebar">
                    <ul class="sidebar-menu">
                        <li class="header">BASIC ADMINISTRATION</li>
                        <li class="{{ Route::currentRouteName() !== 'admin.index' ?: 'active' }}">
                            <a href="{{ route('admin.index') }}">
                                <i class="fa fa-home"></i> <span>Overview</span>
                            </a>
                        </li>
                        <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.settings') ?: 'active' }}">
                            <a href="{{ route('admin.settings')}}">
                                <i class="fa fa-wrench"></i> <span>Settings</span>
                            </a>
                        </li>
                        <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.api') ?: 'active' }}">
                            <a href="{{ route('admin.api.index')}}">
                                <i class="fa fa-gamepad"></i> <span>Application API</span>
                            </a>
                        </li>
                        <li class="header">MANAGEMENT</li>
                        <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.databases') ?: 'active' }}">
                            <a href="{{ route('admin.databases') }}">
                                <i class="fa fa-database"></i> <span>Databases</span>
                            </a>
                        </li>
                        <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.locations') ?: 'active' }}">
                            <a href="{{ route('admin.locations') }}">
                                <i class="fa fa-globe"></i> <span>Locations</span>
                            </a>
                        </li>
                        <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.nodes') ?: 'active' }}">
                            <a href="{{ route('admin.nodes') }}">
                                <i class="fa fa-sitemap"></i> <span>Nodes</span>
                            </a>
                        </li>
                        <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.servers') ?: 'active' }}">
                            <a href="{{ route('admin.servers') }}">
                                <i class="fa fa-server"></i> <span>Servers</span>
                            </a>
                        </li>
                        <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.users') ?: 'active' }}">
                            <a href="{{ route('admin.users') }}">
                                <i class="fa fa-users"></i> <span>Users</span>
                            </a>
                        </li>
                        <li class="header">SERVICE MANAGEMENT</li>
                        <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.mounts') ?: 'active' }}">
                            <a href="{{ route('admin.mounts') }}">
                                <i class="fa fa-magic"></i> <span>Mounts</span>
                            </a>
                        </li>
                        <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.nests') ?: 'active' }}">
                            <a href="{{ route('admin.nests') }}">
                                <i class="fa fa-th-large"></i> <span>Nests</span>
                            </a>
                        </li>
                    </ul>
                </section>
            </aside>
            <div class="content-wrapper">
                <section class="content-header">
                    @yield('content-header')
                </section>
                <section class="content">
                    <div class="row">
                        <div class="col-xs-12">
                            @if (count($errors) > 0)
                                <div class="alert alert-danger">
                                    There was an error validating the data provided.<br><br>
                                    <ul>
                                        @foreach ($errors->all() as $error)
                                            <li>{{ $error }}</li>
                                        @endforeach
                                    </ul>
                                </div>
                            @endif
                            @foreach (Alert::getMessages() as $type => $messages)
                                @foreach ($messages as $message)
                                    <div class="alert alert-{{ $type }} alert-dismissable" role="alert">
                                        {{ $message }}
                                    </div>
                                @endforeach
                            @endforeach
                        </div>
                    </div>
                    @yield('content')
                </section>
            </div>
            <footer class="main-footer">
                <div class="pull-right small text-gray" style="margin-right:10px;margin-top:-7px;">
                    <strong><i class="fa fa-fw {{ $appIsGit ? 'fa-git-square' : 'fa-code-fork' }}"></i></strong> {{ $appVersion }}<br />
                    <strong><i class="fa fa-fw fa-clock-o"></i></strong> {{ round(microtime(true) - LARAVEL_START, 3) }}s
                </div>
                Copyright &copy; 2022 - {{ date('Y') }} <a href="https://nookure.com/">Nookure</a>.
            </footer>
        </div>
        @section('footer-scripts')
            <script src="/js/keyboard.polyfill.js" type="application/javascript"></script>
            <script>keyboardeventKeyPolyfill.polyfill();</script>

            {!! Theme::js('vendor/jquery/jquery.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/sweetalert/sweetalert.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/bootstrap/bootstrap.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/slimscroll/jquery.slimscroll.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/adminlte/app.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/bootstrap-notify/bootstrap-notify.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/select2/select2.full.min.js?t={cache-version}') !!}
            {!! Theme::js('js/admin/functions.js?t={cache-version}') !!}
            <script src="/js/autocomplete.js" type="application/javascript"></script>

            @if(Auth::user()->root_admin)
                <script>
                    $('#logoutButton').on('click', function (event) {
                        event.preventDefault();

                        var that = this;
                        swal({
                            title: 'Do you want to log out?',
                            type: 'warning',
                            showCancelButton: true,
                            confirmButtonColor: '#d9534f',
                            cancelButtonColor: '#d33',
                            confirmButtonText: 'Log out'
                        }, function () {
                             $.ajax({
                                type: 'POST',
                                url: '{{ route('auth.logout') }}',
                                data: {
                                    _token: '{{ csrf_token() }}'
                                },complete: function () {
                                    window.location.href = '{{route('auth.login')}}';
                                }
                        });
                    });
                });
                </script>
            @endif

            <script>
                $(function () {
                    $('[data-toggle="tooltip"]').tooltip();
                })
            </script>
        @show
    </body>
</html>
